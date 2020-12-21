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
                remoteWebsocketConnectionState.isConnected = true

                const authenticateAction = {
                    action: 'authenticate',
                    protocol: '700',
                    password: localStorage.remoteAppPass || 'observer'
                }
                // Authenticating is not necessary apparently, but do it anyway :)
                remoteWebSocket.send(JSON.stringify(authenticateAction))

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
                remoteWebSocket.send(JSON.stringify({action: 'presentationCurrent'}))
                remoteWebSocket.send(JSON.stringify({action: 'presentationSlideIndex'}))
            }
            remoteWebSocket.onmessage = function (ev) {
                const data = JSON.parse(ev.data)
                console.log('RemoteWebSocket Received action: ' + data.action + ' ' + Date.now())
                console.log(data)

                switch (data.action) {
                    case 'authenticate':
                        remoteWebsocketConnectionState.isAuthenticated = data.authenticated === 1 || data.authenticated === true
                        remoteWebsocketConnectionState.proPresenterVersion = data.majorVersion + '.' + data.minorVersion
                        remoteWebsocketConnectionState.error = data.error
                        // const isController = data.controller === 1 || data.controller === true
                        break
                    case 'playlistRequestAll':
                        if (ev.data !== currentPlaylistDataCache) {
                            currentPlaylistDataCache = ev.data
                            onNewPlaylistAll(data)
                        } else if (!undefinedToEmpty(currentPresentationPath).startsWith(currentPlaylist.location)) {
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
                        // Because we can set presentationSlideQuality

                        // TODO: reload without images, then reload with images?
                        remoteWebSocket.send(JSON.stringify({
                            action: 'presentationRequest',
                            presentationPath: data['presentationPath'],
                            presentationSlideQuality: 0
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
            remoteWebSocket.onclose = function (ev) {
                remoteWebsocketConnectionState = WebSocketConnectionState()
                if (ev) {
                    remoteWebsocketConnectionState.error = ev.reason
                }
                updateConnectionErrors()

                setTimeout(connectToRemoteWebsocket, 5000)
                console.log('RemoteWebSocket close ' + JSON.stringify(ev))
            }
        }

        function connectToStageWebSocket() {
            stageWebSocket = new WebSocket('ws://' + getHost() + '/stagedisplay')
            stageWebSocket.onopen = function () {
                stageWebsocketConnectionState.isConnected = true

                const pwd = localStorage.stageAppPass || 'stage'
                const authenticateAction = { acn: 'ath', pwd: pwd, ptl: 610 }
                stageWebSocket.send(JSON.stringify(authenticateAction))

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
                }, 1000)
            }
            stageWebSocket.onmessage = function (ev) {
                const data = JSON.parse(ev.data)
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
                }
                updateConnectionErrors()
                setTimeout(connectToStageWebSocket, 5000)
                console.log('StageWebsocket close ' + JSON.stringify(ev))
            }
        }

        connectToStageWebSocket()
        connectToRemoteWebsocket()
    }

    function updateConnectionErrors() {
        errorDomUpdater.updateConnectionErrors(remoteWebsocketConnectionState, stageWebsocketConnectionState)
    }

    function onNewPlaylistAll(data) {
        const [playlist, index] = proPresenterParser.parsePlaylistAndIndex(data, currentPresentationPath)
        if (playlist) {
            playlistDomUpdater.displayPlaylist(playlist, index)
        } else {
            playlistDomUpdater.clear()
        }
        currentPlaylist = playlist
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
        const newPresentation = proPresenterParser.parsePresentation(data)
        changePresentation(newPresentation, newPresentationPath, currentSlideIndex, currentSlideCleared, true)
    }

    function onNewStageDisplayFrameValue(data) {
        // Cancel timeout for pending stagedisplaytexts
        clearTimeout(displaySlideFromStageDisplayTimeout)

        const currentAndNextStageDisplaySlide = proPresenterParser.parseStageDisplayCurrentAndNext(data)
        const [currentStageDisplaySlide, nextStageDisplaySlide] = currentAndNextStageDisplaySlide

        if (currentSlideUid !== currentStageDisplaySlide.uid) {
            currentSlideUid = currentStageDisplaySlide.uid
            previewDomUpdater.changeSlide(currentSlideUid, nextStageDisplaySlide.uid)
        }

        // Current slide with uid 0000...0000 means clear :)
        if (currentStageDisplaySlide.uid == '00000000-0000-0000-0000-000000000000') {
            const clearSlide = true
            changeCurrentSlide(currentSlideIndex, clearSlide, true)
            return
        }

        const currentStageDisplayText = currentStageDisplaySlide.text
        const nextStageDisplayText = nextStageDisplaySlide.text

        const allPresentationSlideTexts = getSlidesOrEmptyArray().map(s => s.text)

        // currentPresentationPath "stageDisplayText" would mean, the current displayed texts
        // are already from stagedisplay api
        if (currentPresentationPath !== 'stageDisplayText' && currentSlideIndex < allPresentationSlideTexts.length) {
            const currentSlideText = allPresentationSlideTexts[currentSlideIndex]
            if (currentSlideText) {
                const nextSlideText = undefinedToEmpty(allPresentationSlideTexts[currentSlideIndex + 1])
                if (currentSlideText.toLowerCase() === currentStageDisplayText.toLowerCase()
                        && nextSlideText.toLowerCase() === nextStageDisplayText.toLocaleLowerCase()) {
                    // This text is already currently as a normal presentation displayed
                    // Code not reached in pro presenter 7.3.1
                    // Just to be sure, an active presentation will never be replaced by stagedisplay texts
                    return
                }
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
                        const newGroup = Group('', '', [Slide(currentStageDisplayText, undefined)])
                        insertGroupToPresentation(newGroup, 0)
                        changeCurrentSlide(0, false, true)
                        return
                    }

                    // Current stage display text is already on screen
                    if (index === currentSlideIndex + 1 && index + 1 === allPresentationSlideTexts.length) {
                        // nextStageDisplayText is not already on screen, therefore append a new group to presentation
                        const newGroup = Group('', '', [Slide(nextStageDisplayText, undefined)])
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
            let groups = [Group('', '', [Slide(currentStageDisplayText, undefined)])]
            if (nextStageDisplayText && nextStageDisplayText.length >= 0) {
                groups.push(Group('', '', [Slide(nextStageDisplayText, undefined)]))
            }
            // TODO: presentation has text?
            const presentation = Presentation(undefined, groups, true)
            changePresentation(presentation, 'stageDisplayText', 0, false, true)
        }, 100)
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
            }
        }
        currentSlideIndex = newSlideIndex
        currentSlideCleared = newSlideCleared

        const newPresentationJSONString = JSON.stringify(newPresentation)
        if (newPresentationJSONString !== currentPresentationJSONString) {
            if (newPresentation.hasText) {
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
        if (currentPresentation.hasText) {
            // TODO: presentation has text?
        }
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

    return {
        connect: connect
    }
}
