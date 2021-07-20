"use strict"

function ApplicationSettings() {
	let remote, ipcRenderer
	try {
		({ remote, ipcRenderer } = require('electron'))
	} catch (e) {
	}
	if (!remote && !ipcRenderer) {
		console.log('electron remote and ipcRenderer are not available')
		return
	}

	document.getElementById('electronAppSettings').style.display = ''
	const displaySelectElement = document.getElementById('showOnDisplay')
	const displayNoneOptionElement = document.getElementById('showOnDisplayNone')

	const autoStartElement = document.getElementById('autoStart')
	autoStartElement.checked = remote.app.getLoginItemSettings().openAtLogin

	ipcRenderer.on('updateDisplays', function() {
		displaySelectElement.disabled = true
		setTimeout(updateDisplaySelect, 500)
	})
	updateDisplaySelect()

	function updateDisplaySelect() {
		displaySelectElement.innerText = ''
		let showOnDisplay = localStorage.showOnDisplay || -1

		let stagePresenterWindowIsVisible = undefined
		if (remote != undefined) {
			try {
				const wins = remote.BrowserWindow.getAllWindows()
				const stagePresenterWindow = wins.find(w => w.title === 'StagePresenter')
				if (stagePresenterWindow) {
					stagePresenterWindowIsVisible = stagePresenterWindow.isVisible()
				} else {
					stagePresenterWindowIsVisible = false
				}
			} catch (e) {
				stagePresenterWindowIsVisible = false
			}
		}
		if (stagePresenterWindowIsVisible == false) {
			localStorage.showOnDisplay = '-1'
			showOnDisplay = -1
		}

		const displays = remote.screen.getAllDisplays()
		const primaryDisplayId = remote.screen.getPrimaryDisplay().id

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
		remote.app.setLoginItemSettings({openAtLogin: input.checked})
	}

	function onDisplaySelected(option) {
		localStorage.showOnDisplay = option.value
		ipcRenderer.send('displaySelected')
	}

	return {
		onDisplaySelected: onDisplaySelected,
		startAtLogin: startAtLogin
	}
}
