"use strict"

function ProPresenter() {
    const presentationDomUpdater = PresentationDomUpdater()
    const timerDomUpdater = TimerDomUpdater()
    const playlistDomUpdater = PlaylistDomUpdater()

    let currentPlaylistDataCache = undefined
    let currentPlaylist = undefined

    let currentPresentation = undefined
    let currentPresentationPath = ''
    let currentSlideIndex = -1
    let currentSlideCleared = false
    let currentPresentationHash = 0
        
    let displaySlideFromStageDisplayTimeout = undefined
    
    function connect() {
        const remoteWebSocket = new WebSocket('ws://localhost:63147/remote')
        remoteWebSocket.onopen = function () {
            window.onbeforeunload = function () {
                remoteWebSocket.onclose = function () {}
                remoteWebSocket.close()
            }
            const authenticateAction = {
                action: 'authenticate',
                protocol: '700',
                password: 'observer'
            }
            remoteWebSocket.send(JSON.stringify(authenticateAction))
            
            // The following does not give reliable info,
            // if e.g. "quick" bible text is displayed...
            // remoteWebSocket.send(JSON.stringify({action: 'presentationCurrent'}))
            remoteWebSocket.send(JSON.stringify({action: 'presentationSlideIndex'}))
        }
        remoteWebSocket.onmessage = function (ev) {
            const data = JSON.parse(ev.data)
            console.log('RemoteWebSocket Received action: ' + data.action + ' ' + Date.now())
            console.log(data)
            
            switch (data.action) {
                case 'playlistRequestAll':
                    if (ev.data !== currentPlaylistDataCache) {
                        currentPlaylistDataCache = ev.data
                        onNewPlaylistAll(data)
                    }
                    break
                case 'presentationCurrent':
                case 'presentationRequest':
                    onNewPresentation(data)
                    remoteWebSocket.send(JSON.stringify({action: 'playlistRequestAll'}))
                    break
                case 'presentationTriggerIndex':
                    // Slide was clicked in pro presenter...
                    onNewSlideIndex(data)
                    
                    // Reload presentation in case something changed
                    // Instead of requesting current presentation,
                    // we request a specific presentation using the presentationPath
                    // Because we can set presentationSlideQuality to 0
                    
                    // TODO: reload without images, then reload with images?
                    remoteWebSocket.send(JSON.stringify({
                        action: 'presentationRequest',
                        presentationPath: data['presentationPath'],
                        presentationSlideQuality: 360
                    }))
                    break
                case 'presentationSlideIndex':
                    // This action only will be received, when queried first, which does not happen at the moment. 
                    onNewSlideIndex(data)
                    break
                default:
                    console.log('Unknown action', data.action)
                    break
            }
        }
        remoteWebSocket.onclose = function (ev) {}
        
        const stageWebSocket = new WebSocket('ws://localhost:63147/stagedisplay')
        stageWebSocket.onopen = function () {
            window.onbeforeunload = function () {
                stageWebSocket.onclose = function () {}
                stageWebSocket.close()
            }
            
            const authenticateAction = { acn: 'ath', pwd: 'stage', ptl: 610 }
            stageWebSocket.send(JSON.stringify(authenticateAction))
        }
        stageWebSocket.onmessage = function (ev) {
            const data = JSON.parse(ev.data)
            if(data.acn != 'sys' && data.acn != 'vid2' &&  data.acn != 'tmr2') {
                console.log('StageWebSocket Received action: ' + data.acn + ' ' + Date.now())
                console.log(data)
            }
            switch (data.acn) {
                case 'fv': // FrameValue
                    onNewStageDisplayFrameValue(data)
                    break
                case 'sys':
                    timerDomUpdater.updateClock(parseInt(data.txt))
                    break
                case 'tmr':
                    timerDomUpdater.updateTimer(data.uid, data.txt, data.timerMode)
                    // {acn: "tmr", uid: "51D80D93-6CCC-4B45-AA82-C28BAA0F7A2A", txt: "15:08:09", timerMode: 1}
                    break
                case 'vid':
                    timerDomUpdater.updateVideo(data.uid, data.txt)
                    // {acn: "vid", uid: "00000000-0000-0000-0000-000000000000", txt: "00:00:31"}
                    break
                case 'msg':
                    if (data.txt && data.txt.length > 0) {
                        document.getElementById('message').style.display = 'inline-block'
                        document.getElementById('message').innerText = data.txt
                    } else {
                        document.getElementById('message').style.display = 'none'
                    }
                    break
            }
        }
        stageWebSocket.onclose = function (ev) {}
    }
    
    function onNewPlaylistAll(data) {
        const currentLocation = currentPresentationPath.split(':')[0]
        const playlist = data.playlistAll.find(p => p.playlistLocation === currentLocation)
        if (playlist) {
            const newItems = playlist.playlist.map(function (item) {
                return {
                    text: item.playlistItemName,
                    isHeader: item.playlistItemType === 'playlistItemTypeHeader',
                    location: item.playlistItemLocation
                }
            })
            const currentIndex = newItems.findIndex(item => item.location === currentPresentationPath)

            currentPlaylist = {name: playlist.playlistName, items: newItems}
            playlistDomUpdater.displayPlaylist(currentPlaylist, currentIndex)
        } else {
            currentPlaylist = undefined
            playlistDomUpdater.clear()
        }
    }
    
    function onNewSlideIndex(data) {
        clearTimeout(displaySlideFromStageDisplayTimeout)
        
        const newSlideIndex = parseInt(data.slideIndex)
        if (!data.presentationPath || data.presentationPath === currentPresentationPath) {
            // Apparently still same presentation, therefore scroll right away
            changeCurrentSlide(newSlideIndex, false, true)
        } else {
            // Store new values. Presentation will be loaded, then scroll will be issued
            currentSlideIndex = newSlideIndex
            currentSlideCleared = false
        }
    }
    
    function onNewPresentation(data) {
        const newPresentationPath = data.presentationPath
        const newPresentation = parseProPresenterPresentation(data)
        changePresentation(newPresentation, newPresentationPath, currentSlideIndex, currentSlideCleared, true)
    }
    
    function buildPresentation(name, groups) {
        return { 
            name: name, 
            groups: groups, 
            hash: function() { return hash(JSON.stringify(this)) } 
        }
    }
    
    function buildGroup(name, color, slides) {
        return { 
            name: name, 
            color: color, 
            slides: slides 
        }
    }
    
    function buildSlide(text, previewImage) {
        return { 
            text: text, 
            previewImage: previewImage,
        }
    }
    
    function parseProPresenterPresentation(data) {
        function asCSSColor(color) {
            return 'rgba(' + color.split(' ').map(c => c * 255).join(', ') + ')'
        }
        
        const presentation = data.presentation
        let presentationName = presentation.presentationName
        if (!presentationName) {
            presentationName = 'Presentation'
        }
        
        let newGroups = []
        for (const group of presentation.presentationSlideGroups) {
            let newSlides = []
            for (const slide of group.groupSlides) {
                newSlides.push(buildSlide(slide.slideText, slide.slideImage))
            }
            
            if (presentation.presentationSlideGroups.length == 1) {
                // TODO is this correct?
                for (let i = 0; i < group.groupSlides.length; i++) {
                    const slide = group.groupSlides[i]
                    const name = slide.slideLabel
                    const groupColor = asCSSColor(slide.slideColor)
                    newGroups.push(buildGroup(name, groupColor, [newSlides[i]]))
                }
            } else {
                const groupColor = asCSSColor(group.groupColor)
                newGroups.push(buildGroup(group.groupName, groupColor, newSlides))
            }
        }
        return buildPresentation(presentationName, newGroups) 
    }
    
    function onNewStageDisplayFrameValue(data) {
        // Cancel timeout for pending stagedisplaytexts
        clearTimeout(displaySlideFromStageDisplayTimeout)
        
        const stageDisplaySlides = parseStageDisplaySlides(data)
        
        // Current slide with uid 0000...0000 means clear :)
        if (stageDisplaySlides.current.uid == '00000000-0000-0000-0000-000000000000') {
            const clearSlide = true
            changeCurrentSlide(currentSlideIndex, clearSlide, true)
            return
        }
        
        const nextStageDisplayText = stageDisplaySlides.next.txt
        const currentStageDisplayText = stageDisplaySlides.current.txt
        
        const allPresentationSlideTexts = getSlidesOrEmptyArray().map(s => s.text)
        
        // currentPresentationPath "stageDisplayText" would mean, the current displayed texts
        // are already from stagedisplay api
        if (currentPresentationPath !== 'stageDisplayText') {
            const currentSlideText = allPresentationSlideTexts[currentSlideIndex]
            let nextSlideText = allPresentationSlideTexts[currentSlideIndex + 1]
            if (!nextSlideText) {
                nextSlideText = ''
            }
            if ((currentSlideText && currentSlideText.toLowerCase() === currentStageDisplayText.toLowerCase())
                    && (nextSlideText.toLowerCase() === nextStageDisplayText.toLocaleLowerCase())) {
                // This text is already currently as a normal presentation displayed
                // Code not reached in pro presenter 7.3.1
                // Just to be sure, an active presentation will never be replaced by stagedisplay texts
                return
            }
        }
        
        // The timeout will be cancelled if these texts are part of a real presentation
        displaySlideFromStageDisplayTimeout = setTimeout(function () {
            // Timeout was not cancelled, therefore display these stagedisplaytexts
            
            if (currentPresentationPath === 'stageDisplayText') {
                const index = allPresentationSlideTexts.indexOf(currentStageDisplayText)
                const index2 = allPresentationSlideTexts.indexOf(currentStageDisplayText)
                
                if (index === index2) {
                    if (index === -1 && nextStageDisplayText === allPresentationSlideTexts[0]) {
                        // nextStageDisplayText is not already displayed, insert group at index 0
                        const newGroup = buildGroup('', '', [currentStageDisplayText])
                        insertGroupToPresentation(newGroup, 0)
                        changeCurrentSlide(0, false, true)
                        return
                    }
                    
                    // Current stage display text is already on screen
                    if (index === currentSlideIndex + 1 && index + 1 === allPresentationSlideTexts.length) {
                        // nextStageDisplayText is not already on screen, therefore append a new group to presentation
                        const newGroup = buildGroup('', '', [nextStageDisplayText])
                        insertGroupToPresentation(newGroup, index + 1)
                        // Scroll to new slide
                        changeCurrentSlide(index, false, true)
                        return
                    }
                    
                    if (index >= 0 && nextStageDisplayText === undefinedToEmpty(allPresentationSlideTexts[index + 1])) {
                        // Everything is already on screen, just scroll
                        changeCurrentSlide(index, false, true)
                        return
                    }
                }
            }
                    
            // Build a presentation to display
            let groups = [buildGroup('', '', [buildSlide(currentStageDisplayText, undefined)])]
            if (nextStageDisplayText && nextStageDisplayText.length >= 0) {
                groups.push(buildGroup('', '', [buildSlide(nextStageDisplayText, undefined)]))
            }
            const presentation = buildPresentation(undefined, groups)
            changePresentation(presentation, 'stageDisplayText', 0, false, true)
        }, 100)
    }
    
    function parseStageDisplaySlides(data) {
        let currentStageDisplaySlide
        let nextStageDisplaySlide
        
        for (const element of data.ary) {
            switch (element.acn) {
                case 'cs':
                    currentStageDisplaySlide = element
                    break
                case 'ns':
                    nextStageDisplaySlide = element
                    break
                default:
                    // 'csn': current stage display slide notes
                    // 'nsn': next stage display slide notes
                    break
            }
        }
        return { current: currentStageDisplaySlide, next: nextStageDisplaySlide }
    }
        
    function getSlidesOrEmptyArray() {
        let slides = []
        if (!currentPresentation || !currentPresentation.groups) {
            return slides
        }
        for (let group of currentPresentation.groups) {
            slides = slides.concat(group.slides)
        }
        return slides
    }

    function changeCurrentSlide(newSlideIndex, newSlideCleared, animate) {
        // Do it always, even if values did not change
        // Because maybe dom is not yet updated
        currentSlideCleared = newSlideCleared
        currentSlideIndex = newSlideIndex
        presentationDomUpdater.changeCurrentSlideAndScroll(newSlideCleared ? -1 : newSlideIndex, animate)
    }
    
    function changePresentation(newPresentation,
                                newPresentationPath, 
                                newSlideIndex,
                                newSlideCleared,
                                animate) {
        if (newPresentationPath != currentPresentationPath) {
            currentPresentationPath = newPresentationPath
            if (currentPlaylist && currentPlaylist.items) {
                const itemIndex = currentPlaylist.items.findIndex(item => item.location === currentPresentationPath)
                playlistDomUpdater.changeCurrentItemAndScroll(itemIndex)
            } else {
                playlistDomUpdater.clear()
            }
        }
        currentSlideIndex = newSlideIndex
        currentSlideCleared = newSlideCleared
        
        const newPresentationHash = newPresentation.hash()
        if (newPresentationHash !== currentPresentationHash) {
            currentPresentationHash = newPresentationHash
            currentPresentation = newPresentation
            presentationDomUpdater.displayPresentation(newPresentation, newSlideIndex, animate)
        } else {
            presentationDomUpdater.changeCurrentSlideAndScroll(newSlideCleared ? -1 : newSlideIndex, animate)
        }
    }
    
    function insertGroupToPresentation(newGroup, groupIndex) {
        presentationDomUpdater.insertGroupToPresentation(newGroup, groupIndex)
        currentPresentation.groups.splice(groupIndex, 0, newGroup)
        currentPresentationHash = currentPresentation.hash()
    }
    
    return {
        connect: connect
    }
}