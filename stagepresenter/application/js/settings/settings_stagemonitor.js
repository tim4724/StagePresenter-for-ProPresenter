"use strict"

function StageMonitorSettings() {
	// const previewIframe = document.getElementById('previewIframe')
	const stagePresenterSettings = document.getElementById('stagePresenterSettings')
	const zoomInput = document.getElementById('zoom')
	const showSidebar = document.getElementById('showSidebar')
	const previewCheckboxInput = document.getElementById('showSmallSlidePreview')
	const playlistCheckboxInput = document.getElementById('showPlaylist')
	const sidebarMaxSizeInput = document.getElementById('sidebarMaxSize')
	const clockModeInput = document.getElementById('clockMode')
	const minimumVideoLengthForTimer = document.getElementById('minimumVideoLengthForTimer')
	const alignLeftCharactersThreshold = document.getElementById('alignLeftCharactersThreshold')
	const inputs = stagePresenterSettings.querySelectorAll('input, textarea')

	let zoomValue = 1

	let BrowserWindow
	try {
		const { remote } = require('electron')
		BrowserWindow = remote.BrowserWindow
	} catch (e) {
		document.getElementById('zoomSetting').style.display = 'none'
	}

	let getZoomValueInterval = undefined
	let webContents = undefined
	let width = 1920
	let height = 1080

	function listenToZoomChanges() {
		const wins = BrowserWindow.getAllWindows()
		const stagemonitorWindow = wins.find(w => w.title === 'StagePresenter')
		if (stagemonitorWindow
				&& !stagemonitorWindow.isDestroyed()
				&& stagemonitorWindow.isVisible()
				&& stagemonitorWindow.webContents) {
			webContents = stagemonitorWindow.webContents
			const size = stagemonitorWindow.getContentSize()
			width = size[0]
			height = size[1]

			function reset() {
				webContents = undefined
				clearInterval(getZoomValueInterval)
				setTimeout(listenToZoomChanges, 1000)
			}

			function getZoomValue() {
				try {
					if (!stagemonitorWindow.isDestroyed() && stagemonitorWindow.isVisible()) {
						zoomInput.value = 0 | (webContents.zoomFactor * 100)
						zoomValue = webContents.zoomFactor
						// updateZoomPreviewIFrame()
					} else {
						reset()
					}
				} catch(e) {
					reset()
				}
			}
			clearInterval(getZoomValueInterval)
			getZoomValueInterval = setInterval(getZoomValue, 1000)
		}  else {
			webContents = undefined
			setTimeout(listenToZoomChanges, 1000)
		}
	}

	function initInputs() {
		if (localStorage.features === undefined) {
			// as also defined in observer local storage
			localStorage.features = 'flexibleSlides improveBiblePassages showSidebarBottom onlyFirstTextInSlide doNotShowDisabledSlides'
		}
		if (localStorage.sidebarMaxSize === undefined) {
			localStorage.sidebarMaxSize = 150
		}
		if (localStorage.minimumVideoLengthForTimer === undefined) {
			localStorage.minimumVideoLengthForTimer = '00:01:00'
		}
		if (localStorage.alignLeftCharactersThreshold === undefined) {
			localStorage.alignLeftCharactersThreshold = 60
		}

		let features = localStorage.features.split(' ')

		for (const input of inputs) {
			if (input.type && input.type === 'checkbox') {
				input.checked = features.includes(input.id)
			} else if(localStorage[input.id]) {
				input.value = localStorage[input.id]
			}
		}

		for (const option of showSidebar.options) {
			if (features.includes(option.value)) {
				option.selected = true;
				break;
			}
		}

		for (const option of clockMode.options) {
			if (features.includes(option.value)) {
				option.selected = true;
				break;
			}
		}

		if (!features.includes('showPlaylist') && !features.includes('showSmallSlidePreview')
			|| !features.includes('showSidebarBottom') && !features.includes('showSidebarLeft')) {
			sidebarMaxSizeInput.disabled = true
		} else {
			sidebarMaxSizeInput.disabled = false
		}

		if (!features.includes('showSidebarBottom')
				&& !features.includes('showSidebarLeft')) {
			previewCheckboxInput.disabled = true
			playlistCheckboxInput.disabled = true
		} else {
			previewCheckboxInput.disabled = false
			playlistCheckboxInput.disabled = false
		}
	}

	function zoomInputChanged() {
		zoomValue = zoomInput.value / 100.0
		if (webContents) {
			webContents.setZoomFactor(zoomValue)
		}
		// updateZoomPreviewIFrame()
	}

	function checkBoxChanged(element) {
		let features = localStorage.features.split(' ')
		if (element.checked) {
			if (!localStorage.features.includes(element.id)) {
				features.push(element.id)
			}
		} else {
			features = features.filter(f => f !== element.id)
		}
		localStorage.features = features.join(' ')
		initInputs()
	}

	function selectChanged(select) {
		let features = localStorage.features.split(' ')
		let changedFeature = false
		for (const option of select.options) {
			if (option.selected) {
				if (!features.includes(option.value)) {
					features.push(select.value)
					changedFeature = true
				}
			} else if(features.includes(option.value)) {
				features = features.filter(f => f !== option.value)
			}
		}
		localStorage.features = features.join(' ')

		if(select.id === 'showSidebar' && changedFeature) {
			if (features.includes('showSidebarBottom')) {
				localStorage.sidebarMaxSize = 150
				features = features.filter(f => !['showSmallSlidePreview','showPlaylist'].includes(f))
			} else if(features.includes('showSidebarLeft')) {
				localStorage.sidebarMaxSize = 340
				if (!features.includes('showSmallSlidePreview')) {
					features.push('showSmallSlidePreview')
				}
				if (!features.includes('showPlaylist')) {
					features.push('showPlaylist')
				}
			}

			localStorage.features = features.join(' ')
			initInputs()
		}
	}

	function minimumVideoLengthForTimerChanged() {
		let minimumVideoLength = minimumVideoLengthForTimer.value
		if (minimumVideoLength.length == 5) {
			minimumVideoLength = minimumVideoLength + ':00'
		}
		localStorage.minimumVideoLengthForTimer = minimumVideoLength
	}

	/*
	function updateZoomPreviewIFrame() {
		const previewIFrameWidth = previewIframe.clientWidth
		previewIframe.height = previewIFrameWidth * height / width
		let scale = previewIFrameWidth / width * zoomValue

		const contentWindow = previewIframe.contentWindow
		if(contentWindow) {
			const body = contentWindow.window.document.body

			body.style.zoom = scale
			body.style.height = 1 / scale * 100 + 'vh'
		}
	}*/

	function inputChanged(element) {
		localStorage[element.id] = element.value
	}

	if (BrowserWindow) {
		listenToZoomChanges()
	}
	initInputs()
	// updateZoomPreviewIFrame()
	return {
		zoomChanged: zoomInputChanged,
		checkBoxChanged: checkBoxChanged,
		selectChanged: selectChanged,
		minimumVideoLengthForTimerChanged: minimumVideoLengthForTimerChanged,
		inputChanged: inputChanged
	}
}
