"use strict"

function WebSocketConnectionState(isConnected = false,
                                  isAuthenticated= undefined,
                                  proPresenterVersion="",
                                  error="") {
    return {
        isConnected: isConnected,
        isAuthenticated: isAuthenticated,
        proPresenterVersion: proPresenterVersion,
        error: error
    }
}

const stateBroadcastChannel = BroadcastChannel ? new BroadcastChannel('state') : undefined
if (stateBroadcastChannel !== undefined) {
    stateBroadcastChannel.onmessage = (ev) => {
        const action = ev.data.action
        const value = ev.data.value
        switch (action) {
            case 'updateRequest':
                if (stateManagerInstance !== undefined) {
                    const state = stateManagerInstance.getState()
                    stateBroadcastChannel.postMessage({
                        action: 'stateUpdate',
                        value: state
                    })
                }
                break

            case 'playlistIndexAndItemIndex':
                if (stateManagerInstance !== undefined &&
                        proPresenterInstance !== undefined) {
                    const playlistIndex = value.playlistIndex
                    const playlist = stateManagerInstance.getPlaylist(playlistIndex)
                    if (playlist !== undefined) {
                        const item = playlist.items[value.playlistItemIndex]
                        if (item.type == 'playlistItemTypePresentation') {
                            const presentationPath = item.location
                            stateManagerInstance.onNewSlideIndex(presentationPath, -1, true)
                            proPresenterInstance.loadPresentation(presentationPath)
                        } else {
                            // Only other known item type is
                            // playlistItemTypeVideo (also for images)
                            // Therefore show a media presentation
                            const presentation = Presentation(item.text, [])
                            stateManagerInstance.onNewMediaPresentation(presentation, playlistIndex, true)
                        }
                    }
                }
                break

            case 'presentationAndSlideIndex':
                stateManagerInstance.onNewSlideIndex('', value.slideIndex, true)
                stateManagerInstance.onNewPresentation(value.presentation, '', true)
                stateManagerInstance.clearPreview()
                break

            case 'slideIndex':
                if (stateManagerInstance !== undefined) {
                    const presentationPath = stateManagerInstance.getCurrentPresentationPath()
                    stateManagerInstance.onNewSlideIndex(presentationPath, value, true)
                    stateManagerInstance.clearPreview()
                }
                break
        }
    }
}

let stateManagerInstance = undefined
function StagemonitorStateManager() {
    if (stateManagerInstance !== undefined) {
        return stateManagerInstance
    }

    const presentationDomUpdater = PresentationDomUpdater()
    const playlistDomUpdater = PlaylistDomUpdater()
    const previewDomUpdater = PreviewDomUpdater()
    const messageDomUpdater = MessageDomUpdater()

    let currentPlaylists = []
    let currentPlaylistIndex = -1
    let currentPlaylistItemIndex = -1

    let currentPresentation = undefined
    let currentPresentationPath = ''

    let currentSlideIndex = -1
    let currentSlideCleared = false

    let currentSlideUid = undefined // TODO: what about next slide uid?
    let stageMessage = undefined

    function getState() {
        return {
            currentPlaylists: currentPlaylists,
            currentPlaylistIndex: currentPlaylistIndex,
            currentPlaylistItemIndex: currentPlaylistItemIndex,
            currentPresentation: currentPresentation,
            currentPresentationPath: currentPresentationPath,
            currentSlideIndex: currentSlideIndex,
            currentSlideCleared: currentSlideCleared,
            currentSlideUid: currentSlideUid,
            message: message,
        }
    }

    function getPlaylist(playlistIndex) {
        if (currentPlaylists.length === 1) {
            return currentPlaylists[0]
        } else {
            return currentPlaylists[playlistIndex]
        }
    }

    function updatePlaylistAndNextTitle(playlistIndex) {
        let playlist = getPlaylist(playlistIndex)

        if (playlist == undefined) {
            // Clear Playlist and next presentation title
            currentPlaylistIndex = -1
            currentPlaylistItemIndex = -1
            playlistDomUpdater.clear()
            presentationDomUpdater.clearNextPresentationTitle()
        } else {
            const playlistItemIndex = playlist.items.findIndex(i => i.location === currentPresentationPath)
            if (playlistIndex !== currentPlaylistIndex || playlistItemIndex !== currentPlaylistItemIndex) {
                if (playlistIndex != currentPlaylistIndex) {
                    // Change whole playlist
                    playlistDomUpdater.displayPlaylist(playlist, playlistItemIndex)
                } else {
                    // Change current item in playlist
                    playlistDomUpdater.changeCurrentItemAndScroll(playlistItemIndex)
                }

                if (playlistItemIndex >= 0 && playlistItemIndex + 1 < playlist.items.length) {
                    const nextItem = playlist.items[playlistItemIndex + 1]
                    presentationDomUpdater.setNextPresentationTitle(nextItem.text)
                } else {
                    presentationDomUpdater.clearNextPresentationTitle()
                }

                currentPlaylistIndex = playlistIndex
                currentPlaylistItemIndex = playlistItemIndex
            }
        }

        stateBroadcastChannel.postMessage({
            action: 'playlistIndexAndItemIndex',
            value: {
                playlistIndex: currentPlaylistIndex,
                playlistItemIndex: currentPlaylistItemIndex
            }
        })
    }

    function hasText(presentation) {
        return presentation.groups.some(g => g.slides.some(s => s.lines.some(l => l.length > 0)))
    }

    function onNewPreview(slideUid, nextSlideUid) {
        currentSlideUid = slideUid
        previewDomUpdater.changePreview(slideUid, nextSlideUid)
    }

    function clearPreview() {
        previewDomUpdater.clearPreview("")
    }

    function onNewPlaylists(playlists) {
        let playlistIndex = currentPlaylistIndex
        currentPlaylists = playlists
        currentPlaylistIndex = -1

        stateBroadcastChannel.postMessage({action: 'playlists', value: playlists})

        updatePlaylistAndNextTitle(playlistIndex)
    }

    function onNewPresentation(presentation, path, animate = true) {
        currentPresentation = presentation
        currentPresentationPath = path

        const playlistIndex = currentPlaylists.findIndex(p => path.startsWith(p.location))
        updatePlaylistAndNextTitle(playlistIndex >= 0 ? playlistIndex : currentPlaylistIndex)

        // Update preview Dom Updater
        if (hasText(presentation)) {
            previewDomUpdater.hideLargePreview()
        } else {
            previewDomUpdater.showLargePreview()
        }

        // Update presentation
        presentationDomUpdater.displayPresentation(presentation, currentSlideIndex, animate)
        stateBroadcastChannel.postMessage({action: 'presentationAndSlideIndex', value: {
            presentation: presentation,
            slideIndex: currentSlideIndex
        }})
    }

    function onNewMediaPresentation(presentation, playlistIndex=undefined, forceShow=false) {
        const name = presentation.name
        let presentationPath = ''

        if (playlistIndex == undefined) {
            playlistIndex = currentPlaylistIndex
        }
        let playlist = getPlaylist(playlistIndex)
        if (playlist !== undefined) {
            const playlistItemIndex = playlist.items.findIndex(i => i.text === name)
            if (playlistItemIndex >= 0) {
                presentationPath = playlist.items[playlistItemIndex].location
            }
        }

        if (forceShow ||
            presentationPath.length > 0 || 
            !currentPresentation ||
            !hasText(currentPresentation)) {
           onNewPresentation(presentation, presentationPath, true)
           previewDomUpdater.clearPreview(name)
           return true
        }
        return false
    }

    function onNewSlideIndex(presentationPath, index, animate = true) {
        currentSlideIndex = index
        currentSlideCleared = false

        if (currentPresentationPath === presentationPath) {
            presentationDomUpdater.changeCurrentSlideAndScroll(index, animate)
            stateBroadcastChannel.postMessage({action: 'slideIndex', value: index})
        } else {
            // Wait till presentation is loaded...
            console.log("Do not change current slide, first load presentation")
        }
    }

    function clearSlideIndex(animate = true) {
        stateBroadcastChannel.postMessage({action: 'clearSlideIndex', value: undefined})
        currentSlideCleared = true
        presentationDomUpdater.changeCurrentSlideAndScroll(-1, animate)
    }

    function onNewMessage(text) {
        stageMessage = text
        messageDomUpdater.updateMessage(stageMessage)
    }

    stateManagerInstance = {
        onNewPreview: onNewPreview,
        clearPreview: clearPreview,
        onNewPlaylists: onNewPlaylists,
        onNewPresentation: onNewPresentation,
        onNewMediaPresentation: onNewMediaPresentation,
        onNewSlideIndex: onNewSlideIndex,
        clearSlideIndex: clearSlideIndex,
        onNewMessage: onNewMessage,
        getPlaylist: getPlaylist,
        getCurrentPresentationPath: () => currentPresentationPath,
        getCurrentPresentation: () => currentPresentation,
        getCurrentSlideIndex: () => currentSlideIndex,
        getState: getState,
    }
    return stateManagerInstance
}

let proPresenterInstance = undefined
function ProPresenter() {
    if (proPresenterInstance !== undefined) {
        return proPresenterInstance
    }

    const stateManager = StagemonitorStateManager()
    const proPresenterParser = ProPresenterParser()

    // TODO: move to statemanager?
    const errorDomUpdater = ErrorDomUpdater()
    const timerDomUpdater = TimerDomUpdater()

    let remoteWebsocketConnectionState = WebSocketConnectionState()
    let stageWebsocketConnectionState = WebSocketConnectionState()

    let remoteWebSocket = undefined
    let stageWebSocket = undefined
    let remoteWebSocketCloseCounter = 0
    let stageWebSocketCloseCounter = 0

    let currentPlaylistDataCache = undefined
    let currentPresentationDataCache = undefined

    let displaySlidesFromStageDisplayTimeout = undefined

    const Actions = {
        playlistRequestAll: JSON.stringify({action: 'playlistRequestAll'}),
        authenticate: (p) => JSON.stringify({action: 'authenticate', protocol: '740', password: p}),
        ath: (p) => JSON.stringify({ acn: 'ath', pwd: p, ptl: 610 }),
        presentationRequest: (path) => JSON.stringify({
            action: 'presentationRequest',
            presentationPath: path,
            presentationSlideQuality: 0
        })
    }

    function connect() {
        window.onbeforeunload = function () {
            if (remoteWebSocket) {
                remoteWebSocket.onclose = function () {}
                remoteWebSocket.close()
            }
            if (stageWebSocket) {
                stageWebSocket.onclose = function () {}
                stageWebSocket.close()
            }
        }

        function connectToRemoteWebsocket() {
            remoteWebSocket = new WebSocket('ws://' + getHost() + '/remote')
            remoteWebSocket.onopen = function () {
                clearConnectionErrors() // Will be shown after timeout
                remoteWebsocketConnectionState.isConnected = true

                const password = localStorage.remoteAppPass || 'observer'
                // Authenticating is not necessary apparently, but do it anyway :)
                remoteWebSocket.send(Actions.authenticate(password))

                // In case authenticate is not successful
                setTimeout(function() {
                    if (!remoteWebsocketConnectionState.isAuthenticated) {
                        // Close will happen only after timeout, therefore speed things up
                        // TODO: Submit bug report to renewed vision?
                        remoteWebSocket.onclose({reason: remoteWebsocketConnectionState.error})
                        remoteWebSocket.onclose = function () {}
                        remoteWebSocket.close()
                    } else {
                        // remoteWebSocket.onclose will also call showupdateConnectionErrors
                        updateConnectionErrors()
                    }
                }, 1000)

                // The following does not give reliable info, if e.g. "quick" bible text is displayed...
                // Also there are bugs in pro presenter 7.4 and this is wrong sometimes
                // remoteWebSocket.send(JSON.stringify({action: 'presentationCurrent'}))
                // remoteWebSocket.send(JSON.stringify({action: 'presentationSlideIndex'}))
            }
            remoteWebSocket.onmessage = function (ev) {
                remoteWebSocketCloseCounter = 0
                onRemoteWebsocketAction(ev.data)
            }
            remoteWebSocket.onclose = function (ev) {
                remoteWebsocketConnectionState = WebSocketConnectionState()
                if (ev) {
                    remoteWebsocketConnectionState.error = ev.reason
                    console.log('RemoteWebSocket close reason' + ev.reason)
                }
                updateConnectionErrors()

                remoteWebSocketCloseCounter++
                if (remoteWebSocketCloseCounter === 1) {
                    setTimeout(connectToRemoteWebsocket, 50)
                } else {
                    setTimeout(connectToRemoteWebsocket, 5000)
                }
                console.log('RemoteWebSocket close ' + JSON.stringify(ev))
            }
        }

        function connectToStageWebSocket() {
            stageWebSocket = new WebSocket('ws://' + getHost() + '/stagedisplay')
            stageWebSocket.onopen = function () {
                clearConnectionErrors()
                stageWebsocketConnectionState.isConnected = true

                const password = localStorage.stageAppPass || 'stage'
                stageWebSocket.send(Actions.ath(password))

                setTimeout(function() {
                    if (!stageWebsocketConnectionState.isAuthenticated) {
                        // Close will happen only after timeout, therefore speed things up
                        // TODO: Submit bug report to renewed vision?
                        stageWebSocket.onclose({reason: stageWebsocketConnectionState.error})
                        stageWebSocket.onclose = function () {}
                        stageWebSocket.close()
                    } else {
                        // stageWebSocket.onclose will also call showupdateConnectionErrors
                        updateConnectionErrors()
                    }
                }, 2000)
            }
            stageWebSocket.onmessage = function (ev) {
                stageWebSocketCloseCounter = 0
                onStageWebsocketAction(ev.data)
            }
            stageWebSocket.onclose = function (ev) {
                stageWebsocketConnectionState = WebSocketConnectionState()
                if (ev) {
                    stageWebsocketConnectionState.error = ev.reason
                    console.log('StageWebsocket close reason' + ev.reason)
                }
                updateConnectionErrors()
                stageWebSocketCloseCounter++
                if (stageWebSocketCloseCounter === 1) {
                    setTimeout(connectToStageWebSocket, 50)
                } else {
                    setTimeout(connectToStageWebSocket, 6500)
                }
                console.log('StageWebsocket close ' + JSON.stringify(ev))
            }
        }

        // Pro Presenter will crash if not waiting between connecting...
        setTimeout(connectToStageWebSocket, 0)
        // Need to connect in that order for any weird reason...
        setTimeout(connectToRemoteWebsocket, 2000)
    }

    function onStageWebsocketAction(data_string) {
        const data = JSON.parse(data_string)
        if (!data) {
            return
        }
        if(data.acn != 'sys' && data.acn != 'vid' &&  data.acn != 'tmr') {
            console.log('StageWebSocket Received action: ' + data.acn + ' ' + Date.now())
            console.log(data)
        }

        switch (data.acn) {
            case 'ath':
                stageWebsocketConnectionState.isAuthenticated = data.ath === 1 || data.ath === true
                stageWebsocketConnectionState.proPresenterVersion = data.majorVersion + '.' + data.minorVersion
                stageWebsocketConnectionState.error = data.err
                break
            case 'fv': // FrameValue
                onNewStageDisplayFrameValue(data)
                break
            case 'sys':
                timerDomUpdater.updateClock(parseInt(data.txt))
                break
            case 'tmr':
                // {acn: "tmr", uid: "51D80D93-6CCC-4B45-AA82-C28BAA0F7A2A", txt: "15:08:09", timerMode: 1}
                timerDomUpdater.updateTimer(data.uid, data.txt, data.timerMode)
                break
            case 'vid':
                // {acn: "vid", uid: "00000000-0000-0000-0000-000000000000", txt: "00:00:31"}
                timerDomUpdater.updateVideo(data.uid, data.txt)
                break
            case 'msg':
                stateManager.onNewMessage(data.txt)
                break
            default:
                console.log('Unknown action', data.acn)
        }
    }

    function onRemoteWebsocketAction(data_string) {
        const data = JSON.parse(data_string)
        console.log('RemoteWebSocket Received action: ' + data.action + ' ' + Date.now())
        console.log(data)

        switch (data.action) {
            case 'authenticate':
                // const isController = data.controller === 1 || data.controller === true
                remoteWebsocketConnectionState.isAuthenticated = data.authenticated === 1 || data.authenticated === true
                remoteWebsocketConnectionState.proPresenterVersion = data.majorVersion + '.' + data.minorVersion
                remoteWebsocketConnectionState.error = data.error

                remoteWebSocket.send(Actions.playlistRequestAll)
                break
            case 'playlistRequestAll':
                if (data_string !== currentPlaylistDataCache) {
                    currentPlaylistDataCache = data_string
                    stateManager.onNewPlaylists(proPresenterParser.parsePlaylists(data))
                }
                break
            case 'presentationCurrent':
            case 'presentationRequest':
                if (currentPresentationDataCache !== data_string) {
                    currentPresentationDataCache = data_string

                    const presentationPath = data.presentationPath
                    const presentation = proPresenterParser.parsePresentation(data)
                    function hasText(presentation) {
                        return presentation.groups.some(g => g.slides.some(s => s.lines.some(l => l.length > 0)))
                    }
                    const animate = currentPresentationDataCache === undefined || hasText(presentation)
                    stateManager.onNewPresentation(presentation, presentationPath, animate)

                    // TODO: Better send playlistRequestAll in a fix interval?
                    remoteWebSocket.send(Actions.playlistRequestAll)
                }
                break

            case 'presentationSlideIndex':
                // This action only will be received, when queried first, which does not happen at the moment.
            case 'presentationTriggerIndex':
                // Slide of a presentation was clicked in pro presenter...

                // Avoid that a presentation from stagedisplayApi is displayed
                clearTimeout(displaySlidesFromStageDisplayTimeout)

                const presentationPath = data.presentationPath
                const index = parseInt(data.slideIndex)
                stateManager.onNewSlideIndex(presentationPath, index, true)

                // Reload presentation in case something changed
                // Instead of requesting current presentation,
                // we request a specific presentation using the presentationPath
                // Because we can set presentationSlideQuality
                remoteWebSocket.send(Actions.presentationRequest(presentationPath))
                break
            case 'audioTriggered':
                const mediaPresentation = Presentation(data.audioName, [])
                const mediaPresentationDisplayed = stateManager.onNewMediaPresentation(mediaPresentation)
                if (mediaPresentationDisplayed) {
                    timerDomUpdater.forceShowVideo()
                }
                break
            case 'clearAudio':
                // No use for that information at the moment
                break
            case 'clearAll':
                // Also frame value (fv) with uid 000...000 on
                // stageWebSocketwill be recieved, this will hide any text

                // Clear the preview because nothing is displayed at the moment
                stateManager.clearPreview()
                break
            default:
                console.log('Unknown action', data.action)
                break
        }
    }

    function onNewStageDisplayFrameValue(data) {
        // TODO: Parse directly as custom Slide Object?
        const [cs, ns] = proPresenterParser.parseStageDisplayCurrentAndNext(data)

        if (!cs) {
            console.log('onNewStageDisplayFrameValue: Current stagedisplay slide is undefined')
            return
        }

        const currentSlideUid = cs.uid
        const nextSlideUid = ns ? ns.uid : undefined
        stateManager.onNewPreview(currentSlideUid, nextSlideUid)

        // Current slide with uid 0000...0000 means clear :)
        if (cs.uid === '00000000-0000-0000-0000-000000000000') {
            stateManager.clearSlideIndex()
            return
        }

        const currentPresentationPath = stateManager.getCurrentPresentationPath()
        const currentPresentation = stateManager.getCurrentPresentation()

        if (currentPresentationPath !== 'stageDisplayApiPresentation') {
            const currentSlideIndex = stateManager.getCurrentSlideIndex()
            if (currentPresentation != undefined && currentSlideIndex != undefined) {
                const allPresentationSlides = currentPresentation.groups.map(g => g.slides).flat()
                const currentSlide = allPresentationSlides[currentSlideIndex]
                const nextSlide = allPresentationSlides[currentSlideIndex + 1]
                if (currentSlide != undefined && currentSlideIndex.rawText === cs.text &&
                    (nextSlide === ns.text === undefined ||
                        (nextSlide != undefined && nextSlide.rawText === ns.text)) ) {
                    // TODO: Test this code path
                    // This text is already currently as a normal presentation displayed
                    // Code not reached in pro presenter 7.3.1
                    // Just to be sure, an active presentation will never be replaced by stagedisplay texts
                    return
                }
            }
        }

        function displaySlides() {
            currentPresentationDataCache = undefined

            let currentStageDisplaySlide = proPresenterParser.parseSlide(cs.text, undefined, undefined, true)
            currentStageDisplaySlide.stageDisplayApiPresentationUid = cs.uid

            let nextStageDisplaySlide
            if (ns && ns.uid === '00000000-0000-0000-0000-000000000000'
                    && undefinedToEmpty(ns.text).length === 0) {
                nextStageDisplaySlide = undefined
            } else {
                nextStageDisplaySlide = proPresenterParser.parseSlide(ns.text, undefined, undefined, true)
                nextStageDisplaySlide.stageDisplayApiPresentationUid = ns.uid
            }

            const currentPresentation = stateManager.getCurrentPresentation()
            function fixPresentationName(presentation) {
                const groupNames = presentation.groups.map(g => g.name)
                presentation.name = 'Presentation'
                if (groupNames.length === 0) {
                    return
                } else if (groupNames.length === 1) {
                    presentation.name = groupNames[0]
                } else {
                    // Dirty and ugly code to get a presentation name...
                    // TODO: Improve?

                    const l = Math.min(...groupNames.map(n => n.length))
                    name = ''
                    for (let i = 0; i < l; i++) {
                        const char = groupNames[0][i]
                        if ((name.length <= 3 ||char.match(/[A-Za-z\s]/)) && groupNames.map(n => n[i]).every(c => c == char)) {
                            name += char
                        } else {
                            break
                        }
                    }
                    if (name.length >= 3) {
                        presentation.name = name
                    }
                }
            }

            // Change current presentation
            if (currentPresentationPath === 'stageDisplayApiPresentation' && currentPresentation != undefined) {
                const allPresentationSlides = currentPresentation.groups.map(g => g.slides).flat()
                if (allPresentationSlides[0].stageDisplayApiPresentationUid === ns.uid) {
                    const presentation = currentPresentation
                    const name = proPresenterParser.parseGroupName(currentStageDisplaySlide.label)
                    const newGroup = Group(name, '', [currentStageDisplaySlide])
                    presentation.groups.splice(0, 0, newGroup)
                    fixPresentationName(presentation)
                    stateManager.onNewSlideIndex('stageDisplayApiPresentation', 1, false)
                    stateManager.onNewPresentation(presentation, 'stageDisplayApiPresentation', false)
                    stateManager.onNewSlideIndex('stageDisplayApiPresentation', 0, true)
                    return
                } else if (allPresentationSlides[allPresentationSlides.length - 1].stageDisplayApiPresentationUid === cs.uid) {
                    if (nextStageDisplaySlide !== undefined) {
                        const presentation = currentPresentation
                        const name = proPresenterParser.parseGroupName(nextStageDisplaySlide.label)
                        const newGroup = Group(name, '', [nextStageDisplaySlide])
                        presentation.groups.push(newGroup)
                        fixPresentationName(presentation)
                        const index = presentation.groups.length - 2
                        stateManager.onNewSlideIndex('stageDisplayApiPresentation', index, true)
                        stateManager.onNewPresentation(presentation, 'stageDisplayApiPresentation', false)
                    }
                    return
                } else {
                    const index = allPresentationSlides.findIndex(s => s.stageDisplayApiPresentationUid === cs.uid)
                    if (index >= 0) {
                        stateManager.onNewSlideIndex('stageDisplayApiPresentation', index, true)
                        return
                    }
                }
            }

            // Display a new presentation
            const currentName = proPresenterParser.parseGroupName(currentStageDisplaySlide.label)
            let groups = [Group(currentName, '', [currentStageDisplaySlide])]
            if (nextStageDisplaySlide) {
                const nextName = proPresenterParser.parseGroupName(nextStageDisplaySlide.label)
                groups.push(Group(nextName, '', [nextStageDisplaySlide]))
            }
            const presentation = Presentation(undefined, groups)
            fixPresentationName(presentation)
            // First set slide index, then load presentation!
            stateManager.onNewSlideIndex('stageDisplayApiPresentation', 0)
            stateManager.onNewPresentation(presentation, 'stageDisplayApiPresentation', true)
        }

        if (currentPresentationPath === 'stageDisplayApiPresentation' || currentPresentation === undefined) {
            displaySlides()
        } else {
            clearTimeout(displaySlidesFromStageDisplayTimeout)
            // The timeout will be cancelled if these texts are part of a real presentation
            displaySlidesFromStageDisplayTimeout = setTimeout(displaySlides, 500)
        }
    }

    function updateConnectionErrors() {
        errorDomUpdater.updateConnectionErrors(remoteWebsocketConnectionState, stageWebsocketConnectionState)
    }

    function clearConnectionErrors() {
        errorDomUpdater.clearConnectionErrors()
    }

    function exportState() {
        // TODO
    }

    function loadPresentation(presentationPath) {
        currentPresentationDataCache = undefined
        if (remoteWebSocket !== undefined) {
            remoteWebSocket.send(Actions.presentationRequest(presentationPath))
        }
    }

    proPresenterInstance = {
        connect: connect,
        exportState: exportState,
        loadPresentation: loadPresentation,
        // TODO: test reloadCurrentPresentation
        reloadCurrentPresentation: () => loadPresentation(stateManager.getCurrentPresentationPath())
    }
    return proPresenterInstance
}
