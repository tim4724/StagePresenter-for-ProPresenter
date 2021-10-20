"use strict"

function ApplicationSettings() {
	let ipcRenderer = undefined
	try {
		({ ipcRenderer } = require('electron'))
	} catch (e) {
		console.log(e)
	}
	if (ipcRenderer == undefined) {
		console.log('electron remote and ipcRenderer are not available')
		return
	}

	const displaySelectElement = document.getElementById('showOnDisplay')
	const displayNoneOptionElement = document.getElementById('showOnDisplayNone')
	const autoStartElement = document.getElementById('autoStart')

	ipcRenderer.on('updateDisplays', function() {
		displaySelectElement.disabled = true
		setTimeout(updateDisplaySelect, 500)
	})
	updateOpenAtLogin()
	updateDisplaySelect()
	setInterval(updateOpenAtLogin, 1000)

	async function updateOpenAtLogin() {
		const openAtLogin = await ipcRenderer.invoke('get-open-at-login')
		autoStartElement.checked = openAtLogin
	}

	async function updateDisplaySelect() {
		displaySelectElement.innerText = ''
		let showOnDisplay = localStorage.showOnDisplay || -1

		const isStagePresenterWindowVisible =
			await ipcRenderer.invoke('is-stagepresenter-window-visible')
		if (!isStagePresenterWindowVisible) {
			localStorage.showOnDisplay = '-1'
			showOnDisplay = -1
		}

		const displays = await ipcRenderer.invoke('get-all-displays')
		const primaryDisplayId = await ipcRenderer.invoke('get-primary-display-id')

		displaySelectElement.appendChild(displayNoneOptionElement)

		const windowOptionElement = displayNoneOptionElement.cloneNode()
		windowOptionElement.id = "window"
		windowOptionElement.value = "window"
		windowOptionElement.innerText = "Window Mode"
		if (showOnDisplay == '' + "window") {
			windowOptionElement.selected = true
		}

		displaySelectElement.appendChild(windowOptionElement)

		for (let i = 0; i < displays.length; i++) {
			const display = displays[i]

			let displayName = 'Display ' + (i + 1)

			let additionalDetails = []
			if (display.id === primaryDisplayId) {
				additionalDetails.push('Primary')
			}
			if(display.internal) {
				additionalDetails.push('Internal')
			}

			if (additionalDetails.length > 0) {
				displayName += ' (' + additionalDetails.join(', ') + ')'
			}
			displayName += ' ' + display.size.width + 'x' + display.size.height

			const newOptionElement = displayNoneOptionElement.cloneNode()
			newOptionElement.id = display.id
			newOptionElement.value = display.id
			newOptionElement.innerText = displayName

			if (displays.length == 1) {
				newOptionElement.disabled = true
			}
			if (showOnDisplay == '' + display.id) {
				newOptionElement.selected = true
			}

			displaySelectElement.appendChild(newOptionElement)
		}
		displaySelectElement.disabled = false
	}

	function startAtLogin(input) {
		const settings = { openAtLogin: input.checked }
		ipcRenderer.invoke('set-login-item-settings', settings)
	}

	function onDisplaySelected(option) {
		localStorage.showOnDisplay = option.value
		ipcRenderer.send('displaySelected')
	}

	document.getElementById('electronAppSettings').style.display = ''
	return {
		onDisplaySelected: onDisplaySelected,
		startAtLogin: startAtLogin
	}
}
