"use strict"

function TimerDomUpdater() {
	const timezoneOffsetInMinutes = new Date().getTimezoneOffset()
	
	const timerContainer = document.getElementById('left')
	const timeHoursMinutes = document.getElementById('timeHoursMinutes')
	const timeSeconds = document.getElementById('timeSeconds')
	const videoTimer = document.getElementById('videoTimer')
	const playlistElement = document.getElementById('playlist')
	
	const minimumVideoLengthForTimer = '00:01:00'
	let lastKnownVideoTimerText = undefined
	let removeTimeouts = {}
	
	function updateClock(seconds) {
		// TODO: is the time correct?
		let totalMinutes = Math.floor(seconds / 60) - timezoneOffsetInMinutes
		
		let hours = Math.floor(totalMinutes / 60 % 24)
		let minutes = totalMinutes % 60
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
		console.log('original uid', uid)
		uid = 'videoTimer'

		clearTimeout(removeTimeouts[uid])
		if (text === '00:00:00' || text === '-00:00:00' || text === '--:--:--') {
			if (videoTimer.style.display === 'none') {
				// Do not show a timer, that stars with '00:00:00
				return
			}
			removeTimeouts[uid] = setTimeout(function () {
				videoTimer.style.display = 'none'
			}, 1200)
		}
		
		if (text > lastKnownVideoTimerText) {
			// A new timer since text is larger than before
			// If the video length is short, do not display a timer
			// To avoid timers for background videos.
			// TODO: Is there a way to improve this logic?
			if (text < minimumVideoLengthForTimer) {
				videoTimer.style.display = 'none'
			}
		}
		
		// Always show timer if the timer has a value greater than the minimum length
		if (text > minimumVideoLengthForTimer) {
			videoTimer.style.display = 'inline'
		}

		lastKnownVideoTimerText = text

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