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

	const displayPresentationFromStageDisplayDelay = 500
	const updatePresentationFromStageDisplayDelay = 40
	const lowResolutionImageWidth = 32 // Image height 18px
	const middleResolutionImageWidth = 640 // Image height 360px
	const highResolutionImageWidth = 1280 // Image Height 720px

	const Actions = {
		playlistRequestAll: JSON.stringify({action: 'playlistRequestAll'}),
		authenticate: (p) => JSON.stringify({action: 'authenticate', protocol: '799', password: p}),
		ath: (p) => JSON.stringify({ acn: 'ath', pwd: p, ptl: 610 }),
		stageDisplaySets: JSON.stringify({action: "stageDisplaySets"}),
		fv: (uid) => JSON.stringify({acn:"fv", uid: uid}),
		presentationRequest: (path, imageWidth=lowResolutionImageWidth) => {
			lastUsedResolutionImageWidth = imageWidth
			return JSON.stringify({
				action: 'presentationRequest',
				presentationPath: path,
				presentationSlideQuality: imageWidth
			})
		}
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
	let presentationRequestAfterTimeout = undefined
	let lastUsedResolutionImageWidth = lowResolutionImageWidth

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
				!stageWebSocket || [WebSocket.CLOSING, WebSocket.CLOSED].includes(stageWebSocket.readyState)
			const connectToRemoteNecessary =
				!remoteWebSocket  || [WebSocket.CLOSING, WebSocket.CLOSED].includes(remoteWebSocket.readyState)

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
				
				connectionStatusElement.innerText = "Not Connected"
				connectionStatusElement.classList.remove('success')

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
					setTimeout(function() {	onNewStageDisplayFrameValue(data) }, 200)
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
				if (!currentPlaylistDataCache || !isEqual(currentPlaylistDataCache, data)) {
					currentPlaylistDataCache = data
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
				if (!data.presentation) {
					// Sometimes the data has no "presentation". Only occurs since ProPresenter 7.13.
					// We should probably switch soon to the public API, to avoid these bugs.
					
					const presentationPath = data.presentationPath || stateManager.getCurrentPresentationPath()
					console.log("Received invalid presentation data. Request again after timeout")
					clearTimeout(presentationRequestAfterTimeout)
					presentationRequestAfterTimeout = setTimeout(function() {
						const action = Actions.presentationRequest(presentationPath, lastUsedResolutionImageWidth)
						console.log("Request Presentation", presentationPath, lastUsedResolutionImageWidth)
						remoteWebSocket.send(action)
					}, 1000)
					break
				}
				// TODO: Shouldn't the cache always use the lowResolutionImageWidth when comparing presentations?
				if (currentPresentationDataCache && isEqual(currentPresentationDataCache, data)) {
					// Nothing changed in the presentation...
					// Condition does not really work well, 
					// because the JPEG images sometimes differ even if nothing changed...
					break
				}
				currentPresentationDataCache = data
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
						// Not current presentation - ignore
						return
					}

					const animate = shouldAnimate(presentation)
					stateManager.onNewPresentation(presentation, presentationPath, animate)
					// Sometimes (Video-Presentations) the width is twice than the requested `lowResolutionImageWidth`
					// No idea why :D 
					if (width && width <= lowResolutionImageWidth * 2) {	
						const slides = presentation.groups.map(g => g.slides).flat()
						let resolution = undefined
						if (slides.length > 16 || slides.some(s => s.rawText.length > 0)) {
							resolution = middleResolutionImageWidth
						} else {
							// Load presentation with an even higher image resolution
							resolution = highResolutionImageWidth
						}
						console.log("Request Presentation", presentationPath, resolution)
						remoteWebSocket.send(Actions.presentationRequest(presentationPath, resolution))
					}
				})
				break

			case 'presentationSlideIndex':
				// This action only will be received, when queried first, which does not happen at the moment.
			case 'presentationTriggerIndex':
				if (!data.presentationPath) {
					// No "real" presentation was clicked. Therefore ignore action.
					// E.g. A quick bible text was clicked.
					// Fix necessary for ProPresenter 7.9.2. As far as I am aware, this wasn't necessary in earlier versions.
					break
				}
				if (data.slideIndex === -1) {
					// No "real" presentation was clicked. Therefore ignore action.
					// E.g. A quick bible text was clicked.
					// Fix necessary for ProPresenter on Windows (7.8.2, 7.10). WTF.
					break
				}
				// Slide of a presentation was clicked in pro presenter...
				
				// Avoid that a presentation from stagedisplay-Api is displayed
				clearTimeout(displaySlidesFromStageDisplayTimeout)
				// Avoid that a future presentation from stagedisplay-Api is displayed
				setTimeout(() => {clearTimeout(displaySlidesFromStageDisplayTimeout)}, updatePresentationFromStageDisplayDelay)
				setTimeout(() => {clearTimeout(displaySlidesFromStageDisplayTimeout)}, displayPresentationFromStageDisplayDelay)

				// Avoid that a presentation from "audioTriggered" action is displayed
				clearTimeout(displayPresentationFromAudioTriggeredTimeout)
				// Avoid that a presentation from earlier "presentationTriggerIndex" is requested
				clearTimeout(presentationRequestAfterTimeout)

				const presentationPath = data.presentationPath
				if (presentationPath != stateManager.getCurrentPresentationPath()) {
					// Request the presentation right now, as it probably changed...
					console.log("Request Presentation", presentationPath, "default")
					remoteWebSocket.send(Actions.presentationRequest(presentationPath))
					// Ensure that new presentation will be displayed
					currentPresentationDataCache = undefined
				} else {
					// Reload presentation in case something changed
					// Instead of requesting current presentation,
					// we request a specific presentation using the presentationPath
					// Because we can set presentationSlideQuality
					// However reload after timeout to reduce the number of actions sent,
					// if someone clicks many slides in a short timeframe.
					presentationRequestAfterTimeout = setTimeout(function() {
						const action = Actions.presentationRequest(presentationPath, lastUsedResolutionImageWidth)
						console.log("Request Presentation", presentationPath, lastUsedResolutionImageWidth)
						remoteWebSocket.send(action)
					}, 1000)
				}
				const index = parseInt(data.slideIndex)
				stateManager.onNewSlideIndex(presentationPath, index, true)
				break
			case 'audioTriggered':
				const name = data.audioName
				clearTimeout(displayPresentationFromAudioTriggeredTimeout)
				if (!stateManager.isCurrentSlideCleared()) {
					break
				}

				// The timeout will be cancelled if this part of a real presentation
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
				const currentPresentation = stateManager.getCurrentPresentation()
				if (stateManager.getCurrentPresentationPath() === '' && currentPresentation && currentPresentation.name === '') {
					// Fix for ProPresenter on Windows. This "clearText" is wrong. 
					// At the moment "Current" and "Next" from StageDisplay Interface are displayed. (function onNewStageDisplayFrameValue(data))
					break
				}
				stateManager.clearSlideIndex()
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

		// Clear Timeout from previous `onNewStageDisplayFrameValue` event
		// Make new decision if current presentation should be replaced / updated
		clearTimeout(displaySlidesFromStageDisplayTimeout)

		// Current slide with uid 0000...0000 means clear :)
		if (cs.uid === '00000000-0000-0000-0000-000000000000') {
			stateManager.clearSlideIndex()
			return
		}

		const currentPresentationPath = stateManager.getCurrentPresentationPath()
		const currentPresentation = stateManager.getCurrentPresentation()

		if (currentPresentationPath !== '' && !currentPresentation) {
			// Next presentation is currently loading. Do nothing.
			return
		}

		function displaySlides() {
			currentPresentationDataCache = undefined

			let currentStageDisplaySlide = proPresenterParser.parseSlide(cs.text, undefined, undefined, undefined, true)
			currentStageDisplaySlide.stageDisplayApiPresentationUid = cs.uid

			let nextStageDisplaySlide = undefined
			if (ns && ns.uid === '00000000-0000-0000-0000-000000000000' && undefinedToEmpty(ns.text).length === 0) {
				nextStageDisplaySlide = undefined
			} else if (ns) {
				nextStageDisplaySlide = proPresenterParser.parseSlide(ns.text, undefined, undefined, undefined, true)
				nextStageDisplaySlide.stageDisplayApiPresentationUid = ns.uid
			}

			const currentPresentation = stateManager.getCurrentPresentation()

			// Change current presentation
			if (currentPresentationPath === '' && currentPresentation) {
				const allPresentationSlides = currentPresentation.groups.map(g => g.slides).flat()
				let prependCurrentSlide = ns && allPresentationSlides.length > 0 && allPresentationSlides[0].stageDisplayApiPresentationUid === ns.uid
				let appendNextSlide = cs && allPresentationSlides.length > 0 && allPresentationSlides[allPresentationSlides.length - 1].stageDisplayApiPresentationUid === cs.uid
				if (prependCurrentSlide === false && appendNextSlide === false) {
					// Compare `text` instead of `uid`. UID not reliable for ProPresenter on Windows.
					prependCurrentSlide = ns && allPresentationSlides.length > 0 && allPresentationSlides[0].rawText === ns.text
					appendNextSlide = cs && allPresentationSlides.length > 0 && allPresentationSlides[allPresentationSlides.length - 1].rawText === cs.text
				}
				if (prependCurrentSlide) {
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
				} else if (appendNextSlide) {
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
					let slideIndex = allPresentationSlides.findIndex(s => s.stageDisplayApiPresentationUid === cs.uid)
					if (slideIndex < 0) {
						// Fix for ProPresenter (7.10) on Windows.
						// ProPresenter on Windows does not have reliable UIDs. WTF.
						slideIndex = allPresentationSlides.findIndex(s => s.rawText === cs.text)
					}
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

		if (currentPresentationPath === '' && currentPresentation && currentPresentation.name === '') {
			// Assumably, a stage display presentation is already displayed
			// Update that presentation after XXms and display new slides
			// If a new "presentationTriggerIndex" action is received within these XXms, the timout will be cancelled.
			displaySlidesFromStageDisplayTimeout = setTimeout(displaySlides, updatePresentationFromStageDisplayDelay)
		} else {
			// The timeout will be cancelled if these texts are part of a real presentation
			displaySlidesFromStageDisplayTimeout = setTimeout(displaySlides, displayPresentationFromStageDisplayDelay)
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
			console.log("Request Presentation", presentationPath, "default")
			remoteWebSocket.send(Actions.presentationRequest(presentationPath))
		}
	}

	return {
		connect: connect,
		loadPresentation: loadPresentation,
		reloadCurrentPresentation: () => loadPresentation(stateManager.getCurrentPresentationPath())
	}
}
