"use strict"

function StageMonitorSettings() {
	// const previewIframe = document.getElementById('previewIframe')
	const stagePresenterSettings = document.getElementById('stagePresenterSettings')
	const zoomInput = document.getElementById('zoom')
	const showSidebar = document.getElementById('showSidebar')
	const showSlideNotes = document.getElementById('showSlideNotes')
	const previewCheckboxInput = document.getElementById('showSmallSlidePreview')
	const playlistCheckboxInput = document.getElementById('showPlaylist')
	const sidebarSizeInput = document.getElementById('sidebarSize')
	const slideNotesHeightInput = document.getElementById('slideNotesHeight')
	const clockModeInput = document.getElementById('clockMode')
	const minimumVideoLengthForTimer = document.getElementById('minimumVideoLengthForTimer')
	const alignLeftCharactersThreshold = document.getElementById('alignLeftCharactersThreshold')
	const inputs = stagePresenterSettings.querySelectorAll('input, textarea')

	let zoomValue = 100
	let ipcRenderer = undefined
	try {
		({ ipcRenderer } = require('electron'))
	} catch (e) {
		console.log(e)
	}

	async function updateZoom() {
		const zoomFactor = await ipcRenderer.invoke('get-stage-presenter-window-zoom-factor')
		if (zoomFactor >= 0) {
			zoomValue = (0 | (zoomFactor * 100))
			zoomInput.disabled = false
			zoomInput.value = zoomValue
		} else {
			zoomInput.disabled = true
		}
	}

	function initInputs() {
		if (localStorage.features === undefined) {
			// as also defined in observer local storage
			localStorage.features = 'flexibleSlides improveBiblePassages showSidebarBottom onlyFirstTextInSlide doNotShowDisabledSlides doNotShowSlideNotes'
		}
		if (localStorage.sidebarSize === undefined) {
			localStorage.sidebarSize = 150
		}
		if (localStorage.slideNotesHeight === undefined) {
			localStorage.slideNotesHeight = 180
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

		for (const option of clockModeInput.options) {
			if (features.includes(option.value)) {
				option.selected = true;
				break;
			}
		}

		for (const option of showSlideNotes.options) {
			if (features.includes(option.value)) {
				option.selected = true;
				break;
			}
		}

		if (!features.includes('showPlaylist') && !features.includes('showSmallSlidePreview')
			|| !features.includes('showSidebarBottom') && !features.includes('showSidebarLeft')) {
			sidebarSizeInput.disabled = true
		} else {
			sidebarSizeInput.disabled = false
		}

		slideNotesHeightInput.disabled = !features.includes('showSlideNotes')

		if (!features.includes('showSidebarBottom')
				&& !features.includes('showSidebarLeft')) {
			previewCheckboxInput.disabled = true
			playlistCheckboxInput.disabled = true
		} else {
			previewCheckboxInput.disabled = false
			playlistCheckboxInput.disabled = false
		}
	}

	async function zoomInputChanged() {
		if (ipcRenderer) {
			let z = zoomInput.value
			const success = await ipcRenderer.invoke('set-stage-presenter-window-zoom-factor', z / 100.0)
			if (success) {
				zoomValue = z
			} else {
				zoomInput.value = zoomValue
				zoomInput.disabled = true
			}
		}
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
				localStorage.sidebarSize = 150
				features = features.filter(f => !['showSmallSlidePreview','showPlaylist'].includes(f))
			} else if(features.includes('showSidebarLeft')) {
				localStorage.sidebarSize = 340
				if (!features.includes('showSmallSlidePreview')) {
					features.push('showSmallSlidePreview')
				}
				if (!features.includes('showPlaylist')) {
					features.push('showPlaylist')
				}
			}

			localStorage.features = features.join(' ')
			initInputs()
		} else if(select.id === 'showSlideNotes' && changedFeature) {
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

	function inputChanged(element) {
		localStorage[element.id] = element.value
	}

	if (ipcRenderer) {
		updateZoom()
		setInterval(updateZoom, 1000)
	} else {
		document.getElementById('zoomSetting').style.display = 'none'
	}
	initInputs()
	return {
		zoomChanged: zoomInputChanged,
		checkBoxChanged: checkBoxChanged,
		selectChanged: selectChanged,
		minimumVideoLengthForTimerChanged: minimumVideoLengthForTimerChanged,
		inputChanged: inputChanged
	}
}
