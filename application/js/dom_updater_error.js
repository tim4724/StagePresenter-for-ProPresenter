"use strict"

function ErrorDomUpdater() {
	const errorElement = document.getElementById('error')
	const errorMessageElement = document.getElementById('errorMessage')
	window.onerror = function (e) {
		console.log(e)
		const text = 'An error occurred\n' + e
		errorElement.style.display = 'block'
		errorMessageElement.innerText = text
		setTimeout(function () {
			if (text === errorMessageElement.innerText) {
				errorElement.style.display = 'none'
			}
		}, 5000)
	}

	function updateConnectionErrors(remoteWebsocketConnectionState,  stageWebSocketConnectionState) {
		let errorMessages = []

		function checkState(connectionState, name) {
			if (connectionState.error && connectionState.error.length > 0) {
				errorMessages.push(name + ': ' + remoteWebsocketConnectionState.error)
			} else if (!connectionState.isConnected) {
				errorMessages.push('Not connected to ' + name)
			} else if (!connectionState.isAuthenticated) {
				errorMessages.push(name + ': Not Authenticated')
			}
		}

		checkState(remoteWebsocketConnectionState, 'Remote App Interface')
		checkState(stageWebSocketConnectionState, 'Stage App Interface')
		if (errorMessages.length > 0) {
			errorElement.style.display = 'block'
			errorMessageElement.innerText = errorMessages.join('\n')
		} else {
			errorElement.style.display = 'none'
		}
	}

	function clearConnectionErrors() {
		errorMessageElement.innerText = ''
		errorElement.style.display = 'none'
	}

	return {
		updateConnectionErrors: updateConnectionErrors,
		clearConnectionErrors: clearConnectionErrors,
	}
}
