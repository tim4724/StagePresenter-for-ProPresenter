"use strict"

function ConnectionSettings() {
	const hostIsLocalElement = document.getElementById('hostIsLocal')
	const hostIsRemoteElement = document.getElementById('hostIsRemote')
	const ipAddressElement = document.getElementById('ipAddress')
	const portElement = document.getElementById('port')
	const remoteAppPassElement = document.getElementById('remoteAppPass')
	const stageAppPassElement = document.getElementById('stageAppPass')

	const proPresenterVersionElement = document.getElementById('proPresenterVersion')
	const remoteConnectionResultElement = document.getElementById('remoteAppConnectionResult')
	const stageConnectionResultElement = document.getElementById('stageAppConnectionResult')

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
		updateHostIsLocal()

		portElement.value = localStorage.port ||  '49303'
		remoteAppPassElement.value = undefinedToEmpty(localStorage.remoteAppPass)
		stageAppPassElement.value = undefinedToEmpty(localStorage.stageAppPass)
		resetResults()
		updateHostIsLocal()
		connect()
	}

	function resetResults() {
		proPresenterVersionElement.innerText = ''
		remoteConnectionResultElement.innerText = ''
		stageConnectionResultElement.innerText = ''
	}

	function hostIsLocalComputer() {
		ipAddressElement.disabled = true
		if (ipAddressElement.value !== 'localhost') {
			ipAddressElement.value = 'localhost'
			resetResults()
			updateResetButtonState()
			connect()
		}
	}

	function hostIsRemoteComputer() {
		ipAddressElement.disabled = false
		if (ipAddressElement.value === 'localhost') {
			ipAddressElement.value = ''
			resetResults()
			updateResetButtonState()
			connect()
		}
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
			const action1 = { action: 'authenticate', protocol: '700', password: password }
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

	function updateHostIsLocal() {
		const ipAddress = ipAddressElement.value
		if (ipAddress === 'localhost') {
			hostIsLocalElement.checked = true
			hostIsRemoteElement.checked = false
			ipAddressElement.disabled = true
		} else {
			hostIsLocalElement.checked = false
			hostIsRemoteElement.checked = true
			ipAddressElement.disabled = false
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
		clearTimeout(connectTimeout)
		connectTimeout = setTimeout(function() {
			connect()
		}, 500)
	}

	function connect() {
		resetResults()
		updateHostIsLocal()
		const ipAddress = ipAddressElement.value
		const port = portElement.value
		if (!ipAddress || ipAddress.length === 0 || !port || port.length === 0) {
			showResult(proPresenterVersionElement, false, 'Invalid')
		} else {
			// TODO: improve
			testWebSocketConnection(ipAddress, port, 'remote', remoteAppPassElement.value)
			testWebSocketConnection(ipAddress, port, 'stagedisplay', stageAppPassElement.value)
		}
	}

	return {
		onInputChanged: onInputChanged,
		initInputsFromStorage: initInputsFromStorage,
		hostIsLocalComputer: hostIsLocalComputer,
		hostIsRemoteComputer: hostIsRemoteComputer,
		resetResults: resetResults
	}
}
