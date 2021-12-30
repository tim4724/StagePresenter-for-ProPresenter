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
let remoteWebSocket = undefined
let stageWebSocket = undefined
function ProPresenterConnection(stateManager, host) {
	const connectionStatusElement = document.getElementById("connectionStatus")
	const proPresenterParser = ProPresenterParser()

	const lowResolutionImageWidth = 32 // Image height 18px
	const middleResolutionImageWidth = 640 // Image height 360px
	const highResolutionImageWidth = 1280 // Image Height 720px

	const Actions = {
		playlistRequestAll: JSON.stringify({action: 'playlistRequestAll'}),
		authenticate: (p) => JSON.stringify({action: 'authenticate', protocol: '799', password: p}),
		ath: (p) => JSON.stringify({ acn: 'ath', pwd: p, ptl: 610 }),
		stageDisplaySets: JSON.stringify({action: "stageDisplaySets"}),
		fv: (uid) => JSON.stringify({acn:"fv", uid: uid}),
		presentationRequest: (path, imageWidth=lowResolutionImageWidth) => JSON.stringify({
			action: 'presentationRequest',
			presentationPath: path,
			presentationSlideQuality: imageWidth
		})
	}
	let onceConnected = false
	let remoteWebsocketConnectionState = WebSocketConnectionState()
	let stageWebsocketConnectionState = WebSocketConnectionState()

	let remoteWebSocketCloseCounter = 0
	let stageWebSocketCloseCounter = 0

	let currentPlaylistDataCache = undefined
	let currentPresentationDataCache = undefined
	let existingStageDisplayUid = undefined

	let displaySlidesFromStageDisplayTimeout = undefined
	let displayPresentationFromAudioTriggeredTimeout = undefined
	let playlistRequestAllTimeout = undefined
	let presentationRequestAfterSlideClickTimeout = undefined

	function disconnect() {
		if (remoteWebSocket) {
			remoteWebSocket.onclose = function () {}
			remoteWebSocket.close()
		}
		if (stageWebSocket) {
			stageWebSocket.onclose = function () {}
			stageWebSocket.close()
		}
	}

	window.onbeforeunload = disconnect

	function connect() {
		let connectIfNecessaryTimeout = undefined
		let checkAuthenticatedTimeout = undefined

		function connectIfNecessary() {
			// Do not connect to both websockets at the same time, because that will crash ProPresenter
			// Even waiting 500ms is not enough sometimes
			// Therefore we wait 2 seconds between the connection attempts
			const connectToStageNecessary =
				!stageWebSocket || [WebSocket.CLOSING, WebSocket.CLOSED].includes(stageWebSocket.readyState)
			const connectToRemoteNecessary =
				!remoteWebSocket  || [WebSocket.CLOSING, WebSocket.CLOSED].includes(remoteWebSocket.readyState)

			if (connectToStageNecessary) {
				connectToStageWebSocket()
				if (connectToRemoteNecessary) {
					clearTimeout(connectIfNecessaryTimeout)
					connectIfNecessaryTimeout = setTimeout(connectIfNecessary, 2000)
				}
			} else if (connectToRemoteNecessary) {
				connectToRemoteWebsocket()
			}
		}

		function checkAuthenticated() {
			if (remoteWebSocket && !remoteWebsocketConnectionState.isAuthenticated) {
				console.log("RemoteWebSocket is still not authenticated.")
				// Close will happen only after timeout, therefore speed things up
				// TODO: Submit bug report to renewed vision?
				remoteWebSocket.onclose({reason: remoteWebsocketConnectionState.error})
				remoteWebSocket.onclose = function() {}
				remoteWebSocket.close()
			}
			if (stageWebSocket && !stageWebsocketConnectionState.isAuthenticated) {
				console.log("StageWebSocket is still not authenticated.")
				// Close will happen only after timeout, therefore speed things up
				// TODO: Submit bug report to renewed vision?
				stageWebSocket.onclose({reason: stageWebsocketConnectionState.error})
				stageWebSocket.onclose = function () {}
				stageWebSocket.close()
			}
		}

		function connectToRemoteWebsocket() {
			clearTimeout(checkAuthenticatedTimeout)

			remoteWebSocket = new WebSocket('ws://' + host + '/remote')
			remoteWebSocket.onopen = function (ev) {
				onceConnected = true
				clearConnectionErrors() // Will be shown after timeout
				remoteWebsocketConnectionState.isConnected = true
				connectionStatusElement.innerText = "Connected"
				connectionStatusElement.classList.add('success')

				const password = localStorage.remoteAppPass || 'observer'
				// Authenticating is not necessary apparently, but do it anyway :)
				remoteWebSocket.send(Actions.authenticate(password))

				clearTimeout(checkAuthenticatedTimeout)
				checkAuthenticatedTimeout = setTimeout(checkAuthenticated, 1000)

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
				console.log('RemoteWebSocket close ' + JSON.stringify(ev))
				remoteWebsocketConnectionState = WebSocketConnectionState()
				if (ev) {
					remoteWebsocketConnectionState.error = ev.reason
					console.log('RemoteWebSocket close reason' + ev.reason)
				}
				remoteWebSocketCloseCounter++
				if (remoteWebSocketCloseCounter === 1) {
					clearTimeout(connectIfNecessaryTimeout)
					connectIfNecessaryTimeout = setTimeout(connectIfNecessary, 50)
				} else {
					clearTimeout(connectIfNecessaryTimeout)
					connectIfNecessaryTimeout = setTimeout(connectIfNecessary, 2000)
				}
				updateConnectionErrors()
			}
		}

		function connectToStageWebSocket() {
			clearTimeout(checkAuthenticatedTimeout)

			stageWebSocket = new WebSocket('ws://' + host + '/stagedisplay')
			stageWebSocket.onopen = function(ev) {
				onceConnected = true
				clearConnectionErrors()
				stageWebsocketConnectionState.isConnected = true

				const password = localStorage.stageAppPass || 'stage'
				stageWebSocket.send(Actions.ath(password))

				clearTimeout(checkAuthenticatedTimeout)
				checkAuthenticatedTimeout = setTimeout(checkAuthenticated, 3000)
			}
			stageWebSocket.onmessage = function (ev) {
				stageWebSocketCloseCounter = 0
				onStageWebsocketAction(ev.data)
			}
			stageWebSocket.onclose = function (ev) {
				console.log('StageWebsocket close ' + JSON.stringify(ev))
				stageWebsocketConnectionState = WebSocketConnectionState()
				if (ev) {
					stageWebsocketConnectionState.error = ev.reason
					console.log('StageWebsocket close reason' + ev.reason)
				}
				stageWebSocketCloseCounter++
				if (stageWebSocketCloseCounter === 1) {
					clearTimeout(connectIfNecessaryTimeout)
					connectIfNecessaryTimeout = setTimeout(connectIfNecessary, 50)
				} else {
					clearTimeout(connectIfNecessaryTimeout)
					connectIfNecessaryTimeout = setTimeout(connectIfNecessary, 2000)
				}
				updateConnectionErrors()
			}
		}

		connectIfNecessaryTimeout = setTimeout(connectIfNecessary, 1000)
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
				if (remoteWebSocket && remoteWebSocket.readyState == WebSocket.OPEN) {
					onNewStageDisplayFrameValue(data)
				}
				break
			case 'sys':
				stateManager.onNewClock(parseInt(data.txt))
				break
			case 'tmr':
				// {acn: "tmr", uid: "51D80D93-6CCC-4B45-AA82-C28BAA0F7A2A", txt: "15:08:09", timerMode: 1}
				stateManager.onNewTimer(data.uid, data.txt, data.timerMode)
				break
			case 'vid':
				// {acn: "vid", uid: "00000000-0000-0000-0000-000000000000", txt: "00:00:31"}
				stateManager.onNewVideoCountdown(data.uid, data.txt)
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

				// Requests StageDisplaySets in order to get a valid stage display id
				remoteWebSocket.send(Actions.stageDisplaySets)
				break
			case 'playlistRequestAll':
				if (data_string !== currentPlaylistDataCache) {
					currentPlaylistDataCache = data_string
					stateManager.onNewPlaylists(proPresenterParser.parsePlaylists(data))
				}
				clearTimeout(playlistRequestAllTimeout)
				playlistRequestAllTimeout = setTimeout(function() {
					remoteWebSocket.send(Actions.playlistRequestAll)
				}, 2000)
				break
			case 'stageDisplaySets':
				console.log("stageDisplaySets", data)
				if (data.stageLayouts.length > 0) {
					existingStageDisplayUid = data.stageLayouts[0].stageLayoutUUID
				}
				break
			case 'presentationCurrent':
			case 'presentationRequest':
				const startDate = Date.now()
				if (currentPresentationDataCache && isEqual(currentPresentationDataCache, data)) {
					// Nothing changed in the presentation...
					break
				}

				clearTimeout(playlistRequestAllTimeout)
				remoteWebSocket.send(Actions.playlistRequestAll)

				function firstSlideWidth(presentation, callback) {
					const groups = presentation.groups
					if (groups.length > 0
						&& groups[0].slides.length > 0
						&& groups[0].slides[0].previewImage
						&& groups[0].slides[0].previewImage.length > 64) {
						const image = new Image()
						image.onload = function() {
							callback(image.naturalWidth)
						}
						image.onerror = function(e) {
							console.log("WARNING Slide width is undefined because of image error", e)
							callback(undefined)
						}
						image.src = 'data:image/jpeg;base64,' + groups[0].slides[0].previewImage
					} else {
						// No slides
						callback(undefined)
					}
				}

				function shouldAnimate(newPresentation) {
					const oldPresentation = stateManager.getCurrentPresentation()

					if (!oldPresentation || 
						oldPresentation.name !== newPresentation.name ||
						oldPresentation.groups.length !== newPresentation.groups.length) {
						return true
					}

					for (let i = 0; i < newPresentation.groups.length; i++) {
						const newGroup = newPresentation.groups[i]
						const oldGroup = oldPresentation.groups[i]
						if (oldGroup.slides.length !== newGroup.slides.length) {
							return true
						}
						for (let j = 0; j < newGroup.slides.length; j++) {
							const newSlide = newGroup.slides[j]
							const oldSlide = oldGroup.slides[j]
							if (newSlide.rawText !== newSlide.rawText) {
								return true
							}
						}
					}
					// Presentation name and text is identical
					return false
				}

				const presentation = proPresenterParser.parsePresentation(data)
				firstSlideWidth(presentation, (width) => {
					const currentPresentationPath = stateManager.getCurrentPresentationPath()
					const presentationPath = data.presentationPath

					if (currentPresentationPath && currentPresentationPath != presentationPath) {
						console.log("Not current presentation", {
							firstSlideWidth: width,
							currentPresentationPath: currentPresentationPath,
							presentationPath: presentationPath,
							presentation: presentation
						})
						return
						// Not current presentation - ignore
					}

					const animate = shouldAnimate(presentation)
					if (!width || width <= lowResolutionImageWidth) {
						currentPresentationDataCache = data
						stateManager.onNewPresentation(presentation, presentationPath, animate)

						if (width) {
							const slides = presentation.groups.map(g => g.slides).flat()
							let resolution = undefined
							if (slides.length > 16 || slides.some(s => s.rawText.length > 0)) {
								resolution = middleResolutionImageWidth
							} else {
								// Load presentation with an even higher image resolution
								resolution = highResolutionImageWidth
							}
							remoteWebSocket.send(Actions.presentationRequest(presentationPath, resolution))
						}
					} else {
						// The loaded presentation is just the current presentation with higher image resolution...
						stateManager.onNewPresentation(presentation, presentationPath, animate)
					}
				})
				break

			case 'presentationSlideIndex':
				// This action only will be received, when queried first, which does not happen at the moment.
			case 'presentationTriggerIndex':
				// Slide of a presentation was clicked in pro presenter...

				// Avoid that a presentation from stagedisplay-Api is displayed
				clearTimeout(displaySlidesFromStageDisplayTimeout)
				// Avoid that a presentation from "audioTriggered" action is displayed
				clearTimeout(displayPresentationFromAudioTriggeredTimeout)
				// Avoid that a presentation from earlier "presentationTriggerIndex" is requested
				clearTimeout(presentationRequestAfterSlideClickTimeout)

				const presentationPath = data.presentationPath
				const action = Actions.presentationRequest(presentationPath)
				if (presentationPath != stateManager.getCurrentPresentationPath()) {
					// Request the presentation right now, as it probably changed...
					remoteWebSocket.send(action)
					// Ensure that new presentation will be displayed
					currentPresentationDataCache = undefined
				} else {
					// Reload presentation in case something changed
					// Instead of requesting current presentation,
					// we request a specific presentation using the presentationPath
					// Because we can set presentationSlideQuality
					// However reload after timeout to reduce the number of actions sent,
					// if someone clicks many slides in a short timeframe.
					presentationRequestAfterSlideClickTimeout = setTimeout(function() {
						remoteWebSocket.send(action)
					}, 800)
				}

				const index = parseInt(data.slideIndex)
				stateManager.onNewSlideIndex(presentationPath, index, true)
				break
			case 'audioTriggered':
				const name = data.audioName
				clearTimeout(displayPresentationFromAudioTriggeredTimeout)
				// The timeout will be cancelled if these texts are part of a real presentation
				displayPresentationFromAudioTriggeredTimeout = setTimeout(function() {
					const slide = Slide('', 'img/play_banner.png', [], undefined, undefined, "", false, [])
					const group = Group('', '', [slide])
					const p = Presentation(name, [group])
					stateManager.onNewPresentation(p, '')
				}, 20)
				stateManager.forceShowVideoCountdown()
				break
			case 'clearAudio':
				// No use for that information at the moment
				break
			case 'clearAll':
			case 'clearText':
				stateManager.clearSlideIndex()
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

		// Current slide with uid 0000...0000 means clear :)
		if (cs.uid === '00000000-0000-0000-0000-000000000000') {
			stateManager.clearSlideIndex()
			return
		}

		const currentPresentationPath = stateManager.getCurrentPresentationPath()
		const currentPresentation = stateManager.getCurrentPresentation()

		if (currentPresentationPath !== '') {
			const currentSlideIndex = stateManager.getCurrentSlideIndex()
			if (currentPresentation && currentSlideIndex) {
				const allPresentationSlides = currentPresentation.groups.map(g => g.slides).flat()
				const currentSlide = allPresentationSlides[currentSlideIndex]
				const nextSlide = allPresentationSlides[currentSlideIndex + 1]
				if (currentSlide && currentSlideIndex.rawText === cs.text &&
					(!nextSlide && !ns.text || (nextSlide && nextSlide.rawText === ns.text)) ) {
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

			let currentStageDisplaySlide = proPresenterParser.parseSlide(cs.text, undefined, undefined, undefined, true)
			currentStageDisplaySlide.stageDisplayApiPresentationUid = cs.uid

			let nextStageDisplaySlide = undefined
			if (ns && ns.uid === '00000000-0000-0000-0000-000000000000'
					&& undefinedToEmpty(ns.text).length === 0) {
				nextStageDisplaySlide = undefined
			} else if (ns) {
				nextStageDisplaySlide = proPresenterParser.parseSlide(ns.text, undefined, undefined, undefined, true)
				nextStageDisplaySlide.stageDisplayApiPresentationUid = ns.uid
			}

			const currentPresentation = stateManager.getCurrentPresentation()

			// Change current presentation
			if (currentPresentationPath === '' && currentPresentation) {
				const allPresentationSlides = currentPresentation.groups.map(g => g.slides).flat()
				if (ns && allPresentationSlides[0].stageDisplayApiPresentationUid === ns.uid) {
					const presentation = currentPresentation
					if (nextStageDisplaySlide) {
						// Update the one slide that is already in the presentation
						presentation.groups[0].name = proPresenterParser.parseGroupName(nextStageDisplaySlide.label)
						presentation.groups[0].slides[0] = nextStageDisplaySlide
					}
					// Prepend at the start
					const name = proPresenterParser.parseGroupName(currentStageDisplaySlide.label)
					const newGroup = Group(name, '', [currentStageDisplaySlide])
					presentation.groups.splice(0, 0, newGroup)
					stateManager.onNewSlideIndex('', 1, false)
					stateManager.onNewPresentation(presentation, '', false)
					stateManager.onNewSlideIndex('', 0, true)
					return
				} else if (allPresentationSlides[allPresentationSlides.length - 1].stageDisplayApiPresentationUid === cs.uid) {
					const presentation = currentPresentation
					// Update the one slide that is already in the presentation
					const lastGroup = presentation.groups[presentation.groups.length - 1]
					lastGroup.name = proPresenterParser.parseGroupName(currentStageDisplaySlide.label)
					lastGroup.slides[lastGroup.slides.length -1] = currentStageDisplaySlide

					if (nextStageDisplaySlide) {
						// Append at the end of presentation
						const name = proPresenterParser.parseGroupName(nextStageDisplaySlide.label)
						const newGroup = Group(name, '', [nextStageDisplaySlide])
						presentation.groups.push(newGroup)
					}
					// Update presentation and scroll
					const index = allPresentationSlides.length - 1
					stateManager.onNewSlideIndex('', index, true)
					stateManager.onNewPresentation(presentation, '', false)
					return
				} else {
					// Just scroll
					const slideIndex = allPresentationSlides.findIndex(s => s.stageDisplayApiPresentationUid === cs.uid)
					if (slideIndex >= 0) {
						const presentation = currentPresentation
						// Update the two slides of the presentation
						var slideCounter = 0
						for (const group of presentation.groups) {
							for (let i = 0; i < group.slides.length; i++) {
								if (slideCounter == slideIndex) {
									group.name = proPresenterParser.parseGroupName(currentStageDisplaySlide.label)
									group.slides[i] = currentStageDisplaySlide
								} else if(slideCounter == slideIndex + 1 && nextStageDisplaySlide) {
									group.name = proPresenterParser.parseGroupName(nextStageDisplaySlide.label)
									group.slides[i] = nextStageDisplaySlide
								}
								slideCounter += 1
							}
						}
						stateManager.onNewSlideIndex('', slideIndex, true)
						stateManager.onNewPresentation(presentation, '', false)
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
			const presentation = Presentation('', groups)
			// First set slide index, then load presentation!
			stateManager.onNewSlideIndex('', 0)
			stateManager.onNewPresentation(presentation, '', true)
		}

		if (currentPresentationPath === '' || !currentPresentation) {
			displaySlides()
		} else {
			clearTimeout(displaySlidesFromStageDisplayTimeout)
			// The timeout will be cancelled if these texts are part of a real presentation
			displaySlidesFromStageDisplayTimeout = setTimeout(displaySlides, 500)
		}
	}

	function updateConnectionErrors() {
		stateManager.clearConnectionErrors()
		if (onceConnected == false) {
			// Only show errors,
			// if connection once worked, but is now problematic
			return
		}
		stateManager.onNewConnectionErrors(remoteWebsocketConnectionState,
			stageWebsocketConnectionState)
	}

	function clearConnectionErrors() {
		stateManager.clearConnectionErrors()
	}

	function loadPresentation(presentationPath) {
		currentPresentationDataCache = undefined
		if (presentationPath == "") {
			if (stageWebSocket && stageWebSocket.readyState == WebSocket.OPEN
				&& stageWebsocketConnectionState.isAuthenticated
				&& existingStageDisplayUid) {
				stageWebSocket.send(Actions.fv(existingStageDisplayUid))
			}
		} else if (remoteWebSocket && remoteWebSocket.readyState == WebSocket.OPEN
			&& remoteWebsocketConnectionState.isAuthenticated
			&& presentationPath && presentationPath.length > 0) {
			// If the presentationPath is an empty string, ProPresenter will crash always
			remoteWebSocket.send(Actions.presentationRequest(presentationPath))
		}
	}
	return {
		connect: connect,
		loadPresentation: loadPresentation,
		reloadCurrentPresentation: () => loadPresentation(stateManager.getCurrentPresentationPath())
	}
}
