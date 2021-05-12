"use strict"

function ConnectionSettings() {
	const modeDemoElement = document.getElementById('demoMode')
	const modeLocalElement = document.getElementById('localMode')
	const modeRemoteElement = document.getElementById('remoteMode')

	const ipAddressElement = document.getElementById('ipAddress')
	const portElement = document.getElementById('port')
	const remoteAppPassElement = document.getElementById('remoteAppPass')
	const stageAppPassElement = document.getElementById('stageAppPass')

	const proPresenterVersionElement = document.getElementById('proPresenterVersion')
	const remoteConnectionResultElement = document.getElementById('remoteAppConnectionResult')
	const stageConnectionResultElement = document.getElementById('stageAppConnectionResult')

	const testConnectionButton = document.getElementById('connectButton')
	const resetButton = document.getElementById('resetButton')

	let connectTimeout = undefined
	let changed = false

	initInputsFromStorage()

	function showResult(element, success, message) {
		element.innerText = message
		element.classList.remove('successResult', 'errorResult')
		element.classList.add(success ? 'successResult' : 'errorResult')
	}

	function initInputsFromStorage() {
		ipAddressElement.value = localStorage.ipAddress || 'localhost'
		updateConnectionMode()

		portElement.value = localStorage.port || ''
		remoteAppPassElement.value = undefinedToEmpty(localStorage.remoteAppPass)
		stageAppPassElement.value = undefinedToEmpty(localStorage.stageAppPass)
		resetResults()
		updateConnectionMode()
		updateResetButtonState()
	}

	function updateConnectionMode() {
		if ((localStorage.demoMode || 'true') == 'true') {
			modeDemoElement.checked = true
			modeLocalElement.checked = false
			modeRemoteElement.checked = false
			ipAddressElement.disabled = true
			portElement.disabled = true
			testConnectionButton.disabled = true
			remoteAppPassElement.disabled = true
			stageAppPassElement.disabled = true
		} else {
			const ipAddress = ipAddressElement.value
			if (ipAddress === 'localhost') {
				modeDemoElement.checked = false
				modeLocalElement.checked = true
				modeRemoteElement.checked = false
				ipAddressElement.disabled = true
			} else {
				modeDemoElement.checked = false
				modeLocalElement.checked = false
				modeRemoteElement.checked = true
				ipAddressElement.disabled = false
			}
			portElement.disabled = false
			remoteAppPassElement.disabled = false
			stageAppPassElement.disabled = false
			testConnectionButton.disabled = false
		}
	}

	function resetResults() {
		proPresenterVersionElement.innerText = ''
		remoteConnectionResultElement.innerText = ''
		stageConnectionResultElement.innerText = ''
	}

	function selectModeDemo() {
		localStorage.demoMode = true
		updateConnectionMode()
		resetResults()
		updateResetButtonState()
	}

	function selectModeLocal() {
		localStorage.demoMode = false
		ipAddressElement.disabled = true
		if (ipAddressElement.value !== 'localhost') {
			ipAddressElement.value = 'localhost'
		}
		updateConnectionMode()
		resetResults()
		updateResetButtonState()
	}

	function selectModeRemote() {
		localStorage.demoMode = false
		ipAddressElement.disabled = false
		if (ipAddressElement.value === 'localhost') {
			ipAddressElement.value = ''
		}
		updateConnectionMode()
		resetResults()
		updateResetButtonState()
	}

	function testWebSocketConnection(ipAddress, port, path, password) {
		const host = ipAddress + ':' + port
		const webSocket = new WebSocket('ws://' + host + '/' + path)

		function onDone() {
			updateResetButtonState()
			clearTimeout(webSocketTimeout)
			webSocket.onclose = function() {}
			webSocket.close()
		}

		function onAuthenticatedResult(resultElement, hasAuthenticated, error) {
			if (hasAuthenticated) {
				showResult(resultElement, hasAuthenticated, 'Connected')
			} else {
				const msg = error && error.length > 0 ? error : 'Error'
				// TODO: Reconnect after timeout?
				showResult(resultElement, hasAuthenticated, msg)
			}
			onDone()
		}

		const webSocketTimeout = setTimeout(function() {
			// TODO: Reconnect after timeout?
			showResult(proPresenterVersionElement, false, 'Failed to connect')
			onDone()
		}, 3000)

		webSocket.onopen = function () {
			localStorage.ipAddress = ipAddress
			localStorage.port = port
			const action0 = { acn: 'ath', ptl: 610, pwd: password}
			const action1 = { action: 'authenticate', protocol: '740', password: password }
			webSocket.send(JSON.stringify(action0))
			webSocket.send(JSON.stringify(action1))
		}
		webSocket.onmessage = function (ev) {
			const data = JSON.parse(ev.data)
			if (data.action === 'authenticate') {
				const hasAuthenticated = data.authenticated === 1 || data.authenticated === true
				onAuthenticatedResult(remoteConnectionResultElement, hasAuthenticated, data.error)
				if (hasAuthenticated) {
					localStorage.remoteAppPass = password
				}

				const version = data.majorVersion + '.' + data.minorVersion
				const msg = 'Pro Presenter Version ' + version
				showResult(proPresenterVersionElement, true, msg)
			} else if (data.acn === 'ath') {
				const hasAuthenticated = data.ath === 1 || data.ath === true
				if (hasAuthenticated) {
					localStorage.stageAppPass = password
				}
				onAuthenticatedResult(stageConnectionResultElement, hasAuthenticated, data.err)
			}
		}
		webSocket.onclose = function(ev) {
			if (ev.reason && ev.reason.length > 0) {
				showResult(proPresenterVersionElement, false, ev.reason)
			} else {
				showResult(proPresenterVersionElement, false, 'Failed to connect')
			}
			onDone()
		}
	}

	function updateResetButtonState() {
		if (ipAddressElement.value !== localStorage.ipAddress ||
			portElement.value !== localStorage.port ||
			stageAppPassElement.value !== localStorage.stageAppPass ||
			remoteAppPassElement.value !== localStorage.remoteAppPass) {
			resetButton.disabled = false
		} else {
			resetButton.disabled = true
		}
	}

	function onInputChanged() {
		resetResults()
		updateResetButtonState()
	}

	function connect() {
		resetResults()
		updateConnectionMode()
		const ipAddress = ipAddressElement.value
		const port = portElement.value
		if (!ipAddress || ipAddress.length === 0 || !port || port.length === 0) {
			showResult(proPresenterVersionElement, false, 'Invalid')
		} else {
			// TODO: improve?
			testWebSocketConnection(ipAddress, port, 'stagedisplay', stageAppPassElement.value)
			setTimeout(() => {
				testWebSocketConnection(ipAddress, port, 'remote', remoteAppPassElement.value)
			}, 1000)
		}
	}

	return {
		onInputChanged: onInputChanged,
		initInputsFromStorage: initInputsFromStorage,
		selectModeDemo: selectModeDemo,
		selectModeLocal: selectModeLocal,
		selectModeRemote: selectModeRemote,
		resetResults: resetResults,
		connect: connect
	}
}
