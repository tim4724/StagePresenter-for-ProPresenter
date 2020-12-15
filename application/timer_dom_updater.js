"use strict"

function TimerDomUpdater() {
	const timerContainer = document.getElementById('left')
	const timeHoursMinutes = document.getElementById('timeHoursMinutes')
	const timeSeconds = document.getElementById('timeSeconds')
	const videoTimer = document.getElementById('videoTimer')
	const playlistElement = document.getElementById('playlist')
	
	let removeTimeouts = {}

	function updateClock(seconds) {
		// TODO: Time is off by 1 hour, maybe better use Date(milliseconds)...
		let minutes = Math.floor(seconds / 60 % 60)
		let hours = Math.floor(seconds / 3600 % 24)
		seconds = seconds % 60

		if (hours < 10) {
			hours = '0' + hours
		}
		if (minutes < 10) {
			minutes = '0' + minutes
		}
		if (seconds < 10) {
			seconds = '0' + seconds
		}
		timeHoursMinutes.innerText = hours + ':' + minutes
		timeSeconds.innerText = seconds
	}
	
	function updateTimer(uid, text, mode) {
		let timerElement = document.getElementById(uid)
		if (!timerElement) {
			timerElement = document.createElement("span")
			timerElement.id = uid
			timerElement.classList.add('timer')
			timerElement.classList.add(mode === '0' ? 'timerMode0' : 'timerMode1')
			if (playlistElement) {
				timerContainer.insertBefore(timerElement, playlistElement)
			} else {
				timerContainer.appendChild(timerElement)
			}
		}
		
		// TODO: if startval does not change, keep timer visible?
	
		if (text.startsWith('00:')) {
			text = text.substr(3)
		}
		timerElement.innerText = text
		
		clearTimeout(removeTimeouts[uid])
		removeTimeouts[uid] = setTimeout(function () {
			timerElement.parentElement.removeChild(timerElement)
		}, 5000)
	}
	
	function updateVideo(uid, text) {
		uid = 'videoTimer'

		clearTimeout(removeTimeouts[uid])
		if (text === '00:00:00' || text === '-00:00:00' || text === '--:--:--') {
			if (videoTimer.innerText === '') {
				// Do not show a timer, that stars with '00:00:00
				return
			}
			removeTimeouts[uid] = setTimeout(function () {
				videoTimer.innerText = ''
			}, 1200)
		}
		
		if (text.startsWith('00:')) {
			text = text.substr(3)
		} else if (text.startsWith('-00:')) {
			text = text.substr(4)
		}
		videoTimer.innerText = text
	}
	
	return {
		updateClock: updateClock,
		updateTimer: updateTimer,
		updateVideo: updateVideo
	}
}