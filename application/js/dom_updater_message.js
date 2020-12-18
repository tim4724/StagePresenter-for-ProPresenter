"use strict"

function MessageDomUpdater() {
	const messageElement = document.getElementById('message')
	
	function updateMessage(text) {
		if (text && text.length > 0) {
			messageElement.style.display = 'inline-block'
			messageElement.innerText = text
		} else {
			messageElement.style.display = 'none'
		}
	}
	
	return {
		updateMessage: updateMessage,
	}
}