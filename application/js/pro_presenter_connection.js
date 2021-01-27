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

function StagemonitorStateManager() {
    const presentationDomUpdater = PresentationDomUpdater()
    const playlistDomUpdater = PlaylistDomUpdater()
    const previewDomUpdater = PreviewDomUpdater()
    const stateUpdateBroadcast = BroadcastChannel ? new BroadcastChannel('stateUpdate') : undefined

    let currentPlaylist = undefined

    let currentPresentation = undefined
    let currentPresentationPath = ''

    let currentSlideIndex = -1
    let currentSlideCleared = false

    let currentSlideUid = undefined
    let message = undefined

    function onNewPresentation(presentation, path, animate = true) {
        currentPresentation = presentation
        currentPresentationPath = path

        if (presentation.hasText()) {
            previewDomUpdater.hideLargePreview()
        } else {
            previewDomUpdater.showLargePreview()
        }

        presentationDomUpdater.displayPresentation(presentation, currentSlideIndex, animate)
        presentationDomUpdater.clearNextPresentationTitle()

        updatePlaylistIndexAndNextUp()
    }

    function updatePlaylistIndexAndNextUp() {
        if (currentPlaylist && currentPlaylist.items) {
            // TODO: Check ambigious name
            const index = currentPlaylist.items.findIndex(i => i.text === presentation.name)
            playlistDomUpdater.changeCurrentItemAndScroll(index)

            if (index >= 0 && index + 1 < currentPlaylist.items.length) {
                const nextItem = currentPlaylist.items[index + 1]
                presentationDomUpdater.setNextPresentationTitle(nextItem.text)
            }
        }
    }

    return {
        onNewPlaylist: (playlist) => {
            currentPlaylist = playlist
            if (currentPlaylist !== undefined) {
                // TODO: Bool animate?
                // TODO: do not set index with displayPlaylist?
                playlistDomUpdater.displayPlaylist(playlist, -1)
                updatePlaylistIndexAndNextUp()
            } else {
                playlistDomUpdater.clear()
                presentationDomUpdater.clearNextPresentationTitle()
            }
        },

        onNewPresentation: onNewPresentation,

        onNewSlideIndex: (presentationPath, index, animate = true) => {
            currentSlideIndex = index
            currentSlideCleared = false
            if (currentPresentationPath === presentationPath) {
                presentationDomUpdater.changeCurrentSlideAndScroll(index, animate)
            } else {
                currentPresentationPath = presentationPath
                // Wait till presentation is loaded...
                console.log("Do not change current slide, first load presentation")
            }
        },

        clearSlideIndex: (animate = true) => {
            currentSlideCleared = true
            presentationDomUpdater.changeCurrentSlideAndScroll(-1, animate)
        },

        clearPreview: () => {
            previewDomUpdater.clearPreview("")
        },

        onNewPreview: (slideUid, nextSlideUid) => {
            currentSlideUid = slideUid
            previewDomUpdater.changePreview(slideUid, nextSlideUid)
        },

        onMediaPresentation: (presentation, timerDomUpdater) => {
            const name = presentation.name
            let index = -1
            if (currentPlaylist && currentPlaylist.items) {
                // TODO: Check ambigious name
                index = currentPlaylist.items.findIndex(i => i.text === name)
            }

            const presentationPath = index >= 0 ? items[index].location : name

            if (index >= 0 || !currentPresentation || !currentPresentation.hasText()) {
                onNewPresentation(presentation, presentationPath, true)
                timerDomUpdater.forceShowVideo()
            }
            previewDomUpdater.clearPreview(name)
        }
    }
}

function ProPresenter() {
    const proPresenterParser = ProPresenterParser()
    const state = StagemonitorStateManager()
    const errorDomUpdater = ErrorDomUpdater()
    const messageDomUpdater = MessageDomUpdater()
    const timerDomUpdater = TimerDomUpdater()

    let remoteWebsocketConnectionState = WebSocketConnectionState()
    let stageWebsocketConnectionState = WebSocketConnectionState()

    let remoteWebSocket = undefined
    let stageWebSocket = undefined
    let remoteWebSocketCloseCounter = 0
    let stageWebSocketCloseCounter = 0

    let currentPlaylistDataCache = undefined
    let currentPresentationDataCache = undefined

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
                messageDomUpdater.updateMessage(data.txt)
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

                    // TODO: DO net get presentationSlideIndex
                    // TODO: Parse all playlists and get list of playlists
                    const [playlist, index] = proPresenterParser.parsePlaylistAndIndex(data, "0:0")
                    state.onNewPlaylist(playlist)
                }
                break
            case 'presentationCurrent':
            case 'presentationRequest':
                if (currentPresentationDataCache !== data_string) {
                    currentPresentationDataCache = data_string

                    const presentationPath = data.presentationPath
                    const presentation = proPresenterParser.parsePresentation(data)
                    const animate = currentPresentationDataCache === undefined || presentation.hasText()
                    state.onNewPresentation(presentation, presentationPath, animate)

                    // TODO: Better send playlistRequestAll in a fix interval?
                    remoteWebSocket.send(Actions.playlistRequestAll)
                }
                break

            case 'presentationSlideIndex':
                // This action only will be received, when queried first, which does not happen at the moment.
            case 'presentationTriggerIndex': // Slide was clicked in pro presenter...
                const presentationPath = data.presentationPath
                const index = parseInt(data.slideIndex)
                state.onNewSlideIndex(presentationPath, index, true)

                // Reload presentation in case something changed
                // Instead of requesting current presentation,
                // we request a specific presentation using the presentationPath
                // Because we can set presentationSlideQuality
                remoteWebSocket.send(Actions.presentationRequest(presentationPath))
                break
            case 'audioTriggered':
                state.onMediaPresentation(Presentation(data.audioName, []), timerDomUpdater)
                break
            case 'clearAudio':
                // No use for that information at the moment
                break
            case 'clearAll':
                // Also frame value (fv) with uid 000...000 on
                // stageWebSocketwill be recieved, this will hide any text

                // Clear the preview because nothing is displayed at the moment
                state.clearPreview()
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
        state.onNewPreview(currentSlideUid, nextSlideUid)

        // Current slide with uid 0000...0000 means clear :)
        if (cs.uid === '00000000-0000-0000-0000-000000000000') {
            state.clearSlideIndex()
            return
        }

        // TODO: Create presentation and display if necessary
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

    function importState() {
        // TODO
    }

    function reloadCurrentPresentation() {
        // TODO
    }

    return {
        connect: connect,
        exportState: exportState,
        importState: importState,
        reloadCurrentPresentation: reloadCurrentPresentation
    }
}
