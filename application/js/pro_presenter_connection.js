"use strict"

function WebSocketConnectionState() {
    return {
        isConnected: false,
        isAuthenticated: undefined,
        proPresenterVersion: "",
        error: ""
    }
}

let remoteWebSocket = undefined
let stageWebSocket = undefined

function ProPresenter() {
    const proPresenterParser = ProPresenterParser()
    const errorDomUpdater = ErrorDomUpdater()
    const messageDomUpdater = MessageDomUpdater()
    const presentationDomUpdater = PresentationDomUpdater()
    const timerDomUpdater = TimerDomUpdater()
    const playlistDomUpdater = PlaylistDomUpdater()
    const previewDomUpdater = PreviewDomUpdater()

    let remoteWebSocketCloseCounter = 0
    let stageWebSocketCloseCounter = 0

    let remoteWebsocketConnectionState = WebSocketConnectionState()
    let stageWebsocketConnectionState = WebSocketConnectionState()

    let currentPlaylistDataCache = undefined
    let currentPlaylist = undefined

    let currentPresentationJSONString = undefined
    let currentPresentation = undefined
    let currentPresentationPath = ''
    let currentSlideIndex = -1
    let currentSlideCleared = false

    let currentSlideUid = undefined
    let displaySlideFromStageDisplayTimeout = undefined

    const Actions = {
        playlistRequestAll: JSON.stringify({action: 'playlistRequestAll'}),
        authenticate: (p) => JSON.stringify({action: 'authenticate', protocol: '700', password: p}),
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
                const data = JSON.parse(ev.data)
                console.log('RemoteWebSocket Received action: ' + data.action + ' ' + Date.now())
                console.log(data)

                remoteWebSocketCloseCounter = 0

                switch (data.action) {
                    case 'authenticate':
                        remoteWebsocketConnectionState.isAuthenticated = data.authenticated === 1 || data.authenticated === true
                        remoteWebsocketConnectionState.proPresenterVersion = data.majorVersion + '.' + data.minorVersion
                        remoteWebsocketConnectionState.error = data.error
                        // const isController = data.controller === 1 || data.controller === true

                        remoteWebSocket.send(Actions.playlistRequestAll)
                        if (currentPresentationPath.length > 0) {
                            remoteWebSocket.send(Actions.presentationRequest(currentPresentationPath))
                        }
                        break
                    case 'playlistRequestAll':
                        if (!currentPlaylist || ev.data !== currentPlaylistDataCache) {
                            currentPlaylistDataCache = ev.data
                            onNewPlaylistAll(data)
                        } else if (!undefinedToEmpty(currentPresentationPath).startsWith(currentPlaylist.location)) {
                            const itemIndex = currentPlaylist.items.findIndex(item => item.location === currentPresentationPath)
                            playlistDomUpdater.changeCurrentItemAndScroll(itemIndex)
                            const nextItem = currentPlaylist.items[itemIndex + 1]
                            presentationDomUpdater.setNextPresentationTitle(nextItem ? nextItem.text : undefined)
                        }
                        break
                    case 'presentationCurrent':
                    case 'presentationRequest':
                        onNewPresentation(data)
                        remoteWebSocket.send(Actions.playlistRequestAll)
                        break
                    case 'presentationTriggerIndex':
                        // Slide was clicked in pro presenter...
                        onNewSlideIndex(data)

                        // Reload presentation in case something changed
                        // Instead of requesting current presentation,
                        // we request a specific presentation using the presentationPath
                        // Because we can set presentationSlideQuality
                        remoteWebSocket.send(Actions.presentationRequest(data['presentationPath']))
                        break
                    case 'presentationSlideIndex':
                        // This action only will be received, when queried first, which does not happen at the moment.
                        onNewSlideIndex(data)
                        break
                    case 'audioTriggered':
                        onAudioTriggered(data)
                        break
                    default:
                        console.log('Unknown action', data.action)
                        break
                }
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
                const data = JSON.parse(ev.data)
                if (!data) {
                    return
                }
                stageWebSocketCloseCounter = 0
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
                        messageDomUpdater.updateMessage(data.txt)
                        break
                    default:
                        console.log('Unknown action', data.acn)
                }
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

    function updateConnectionErrors() {
        errorDomUpdater.updateConnectionErrors(remoteWebsocketConnectionState, stageWebsocketConnectionState)
    }

    function clearConnectionErrors() {
        errorDomUpdater.clearConnectionErrors()
    }

    function onNewPlaylistAll(data) {
        const [playlist, index] = proPresenterParser.parsePlaylistAndIndex(data, currentPresentationPath)
        currentPlaylist = playlist
        if (playlist) {
            playlistDomUpdater.displayPlaylist(playlist, index)
            const nextItem = playlist.items[index + 1]
            presentationDomUpdater.setNextPresentationTitle(nextItem ? nextItem.text : undefined)
        } else {
            playlistDomUpdater.clear()
            presentationDomUpdater.clearNextPresentationTitle()
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

    function onAudioTriggered(data) {
        const name = data.audioName

        let currentPlaylistItemIndex = -1
        if(currentPlaylist && currentPlaylist.items) {
            currentPlaylistItemIndex = currentPlaylist.items.findIndex(item => item.text === name)
        }
        if (currentPlaylistItemIndex >= 0) {
            previewDomUpdater.clearPreview(name)
            const newPresentation = Presentation(name, [])
            const newPresentationPath = currentPlaylist.items[currentPlaylistItemIndex].location
            changePresentation(newPresentation, newPresentationPath, -1, true, false)
            timerDomUpdater.forceShowVideo()
        } else if (!currentPresentation || !currentPresentation.hasText()) {
            previewDomUpdater.clearPreview(name)
            const newPresentation = Presentation(name, [])
            const newPresentationPath = '-1:-1'
            changePresentation(newPresentation, newPresentationPath, -1, true, false)
            timerDomUpdater.forceShowVideo()
        } else {
            previewDomUpdater.clearPreview(name)
        }
    }

    function onNewPresentation(data) {
        const newPresentationPath = data.presentationPath
        const newPresentation = proPresenterParser.parsePresentation(data)
        const animate = newPresentation.hasText() || (currentPresentation !== undefined && currentPresentation.hasText())
        changePresentation(newPresentation, newPresentationPath, currentSlideIndex, currentSlideCleared, animate)
    }

    function onNewStageDisplayFrameValue(data) {
        // Cancel timeout for pending stagedisplaytexts
        clearTimeout(displaySlideFromStageDisplayTimeout)

        // TODO: Parse directly as slide?
        const currentAndNextStageDisplaySlide = proPresenterParser.parseStageDisplayCurrentAndNext(data)
        const [cs, ns] = currentAndNextStageDisplaySlide

        if (!cs) {
            console.log('onNewStageDisplayFrameValue: Current stagedisplay slide is undefined')
            return
        }

        currentSlideUid = cs.uid
        const nextSlideUid = ns ? ns.uid : undefined
        previewDomUpdater.changePreview(currentSlideUid, nextSlideUid)

        // Current slide with uid 0000...0000 means clear :)
        if (cs.uid === '00000000-0000-0000-0000-000000000000') {
            const clearSlide = true
            changeCurrentSlide(currentSlideIndex, clearSlide, true)
            return
        }

        const allPresentationSlides = getSlidesOrEmptyArray()

        const currentSlide = allPresentationSlides[currentSlideIndex]
        const nextSlide = allPresentationSlides[currentSlideIndex + 1]

        // Assume text is bible passage...
        // Because most of the time it will be a bible passage...
        const currentStageDisplaySlide = proPresenterParser.parseSlide(cs.text, undefined, undefined, true)

        let nextStageDisplaySlide
        if (ns && ns.uid === '00000000-0000-0000-0000-000000000000'
                && undefinedToEmpty(ns.text).length === 0) {
            nextStageDisplaySlide = undefined
        } else {
            nextStageDisplaySlide = proPresenterParser.parseSlide(ns.text, undefined, undefined, true)
        }

        // currentPresentationPath "stagedisplay" would mean, the current displayed texts
        // are already from stagedisplay api
        if (currentPresentationPath !== 'stagedisplay' && currentSlide) {
            if (currentSlide.rawText === currentStageDisplaySlide.rawText
                    && (nextSlide === nextStageDisplaySlide === undefined
                        || (nextSlide && nextStageDisplaySlide && nextSlide.rawText === nextStageDisplaySlide.rawText))) {
                // This text is already currently as a normal presentation displayed
                // Code not reached in pro presenter 7.3.1
                // Just to be sure, an active presentation will never be replaced by stagedisplay texts
                return
            }
        }

        function displaySlideFromStageDisplay() {
            if (currentPresentationPath === 'stagedisplay') {
                // TODO: Use UID to compare?
                const index = allPresentationSlides.map(s => s.rawText).indexOf(currentStageDisplaySlide.rawText)
                const index2 = allPresentationSlides.map(s => s.rawText).lastIndexOf(currentStageDisplaySlide.rawText)

                if (index === index2) {
                    if (index === -1 && allPresentationSlides.length > 0 && nextStageDisplaySlide &&
                            nextStageDisplaySlide.rawText === allPresentationSlides[0].rawText) {
                        // currentStageDisplaySlide is not already displayed, insert group at index 0
                        const name = proPresenterParser.parseGroupName(currentStageDisplaySlide.label)
                        const newGroup = Group(name, '', [currentStageDisplaySlide])
                        insertGroupToPresentation(newGroup, 0)
                        changeCurrentSlide(0, false, true)
                        return
                    }

                    // Current stage display text is already on screen
                    if (index >= 0 && index === currentSlideIndex + 1 && index + 1 === allPresentationSlides.length) {
                        if (nextStageDisplaySlide) {
                            // nextStageDisplaySlide is not already on screen, therefore append a new group to presentation
                            const name = proPresenterParser.parseGroupName(nextStageDisplaySlide.label)
                            const newGroup = Group(name, '', [nextStageDisplaySlide])
                            insertGroupToPresentation(newGroup, index + 1)
                        }
                        // Scroll to new slide
                        changeCurrentSlide(index, false, true)
                        return
                    }

                    if (index >= 0 && nextStageDisplaySlide && index + 1 < allPresentationSlides.length
                            && nextStageDisplaySlide.rawText === allPresentationSlides[index + 1].rawText) {
                        // Everything is already on screen, just scroll
                        changeCurrentSlide(index, false, true)
                        return
                    }
                }
            }

            // Build a presentation to display
            const currentName = proPresenterParser.parseGroupName(currentStageDisplaySlide.label)
            let groups = [Group(currentName, '', [currentStageDisplaySlide])]
            if (nextStageDisplaySlide) {
                const nextName = proPresenterParser.parseGroupName(nextStageDisplaySlide.label)
                groups.push(Group(nextName, '', [nextStageDisplaySlide]))
            }
            // TODO: presentation has text?
            const presentation = Presentation(undefined, groups)
            changePresentation(presentation, 'stagedisplay', 0, false, true)
        }

        if (currentPresentationPath === 'stagedisplay' || currentPresentationPath === undefined) {
            displaySlideFromStageDisplay()
        } else {
            clearTimeout(displaySlideFromStageDisplayTimeout)
            // The timeout will be cancelled if these texts are part of a real presentation
            displaySlideFromStageDisplayTimeout = setTimeout(
                displaySlideFromStageDisplay,
                500
            )
        }
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
        if (newPresentationPath !== currentPresentationPath) {
            currentPresentationPath = newPresentationPath
            if (currentPlaylist && currentPlaylist.items && newPresentationPath.startsWith(currentPlaylist.location)) {
                const itemIndex = currentPlaylist.items.findIndex(item => item.location === currentPresentationPath)
                playlistDomUpdater.changeCurrentItemAndScroll(itemIndex)

                const nextItem = currentPlaylist.items[itemIndex + 1]
                presentationDomUpdater.setNextPresentationTitle(nextItem ? nextItem.text : undefined)
            } else {
                playlistDomUpdater.changeCurrentItemAndScroll(-1)
                presentationDomUpdater.clearNextPresentationTitle()
            }
        }
        currentSlideIndex = newSlideIndex
        currentSlideCleared = newSlideCleared

        const newPresentationJSONString = JSON.stringify(newPresentation)
        if (newPresentationJSONString !== currentPresentationJSONString) {
            console.log('changePresentation')
            console.log(currentPresentationJSONString)
            console.log(newPresentationJSONString)

            if (newPresentation.hasText()) {
                previewDomUpdater.hideLargePreview()
            } else {
                previewDomUpdater.showLargePreview()
            }
            currentPresentationJSONString = newPresentationJSONString
            currentPresentation = newPresentation
            presentationDomUpdater.displayPresentation(newPresentation, newSlideIndex, animate)
        } else {
            presentationDomUpdater.changeCurrentSlideAndScroll(newSlideCleared ? -1 : newSlideIndex, animate)
        }
    }

    function insertGroupToPresentation(newGroup, groupIndex) {
        presentationDomUpdater.insertGroupToPresentation(newGroup, groupIndex)
        currentPresentation.groups.splice(groupIndex, 0, newGroup)
        currentPresentationJSONString = JSON.stringify(currentPresentation)
    }

    function getSlidesOrEmptyArray() {
        let slides = []
        if (!currentPresentation || !currentPresentation.groups) {
            return slides
        }
        for (const group of currentPresentation.groups) {
            slides = slides.concat(group.slides)
        }
        return slides
    }

    function exportState() {
        return {
            currentPresentationPath: currentPresentationPath,
            currentSlideIndex: currentSlideIndex,
            currentSlideCleared: currentSlideCleared,
            currentSlideUid: currentSlideUid,
        }
    }

    function importState(state) {
        currentPresentationPath = state.currentPresentationPath
        currentSlideIndex = state.currentSlideIndex
        currentSlideCleared = state.currentSlideCleared
        currentSlideUid = state.currentSlideUid

        previewDomUpdater.changePreview(currentSlideUid, undefined)
        reloadCurrentPresentation()
    }

    function reloadCurrentPresentation(force) {
        if(remoteWebSocket && remoteWebSocket.readyState === WebSocket.OPEN) {
            remoteWebSocket.send(Actions.presentationRequest(currentPresentationPath))
            if (force) {
                currentPresentationJSONString = ''
            }
        }
    }

    return {
        connect: connect,
        exportState: exportState,
        importState: importState,
        reloadCurrentPresentation: reloadCurrentPresentation
    }
}
