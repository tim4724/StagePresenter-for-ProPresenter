"use strict"

function TimerDomUpdater() {
	const timezoneOffsetInMinutes = new Date().getTimezoneOffset()

	const timerContainer = document.getElementById('timerContainer')

	const clockHoursMinutes = document.getElementById('clockHoursMinutes')
	const clockSeconds = document.getElementById('clockSeconds')
	const videoTimer = document.getElementById('videoTimer')

	let lastKnownVideoTimerText = '00:00:00'
	let timeouts = {}

	function updateClock(seconds) {
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
		clockHoursMinutes.innerText = hours + ':' + minutes
		clockSeconds.innerText = seconds
	}

	function updateTimer(uid, text, mode) {
		let timerElement = document.getElementById(uid)
		if (!timerElement) {
			if (text === '00:00:00' || text === '-00:00:00' || text === '--:--:--') {
				return
			}

			timerElement = document.createElement("span")
			timerElement.id = uid
			timerElement.classList.add('timer')
			timerElement.classList.add('timerMode' + mode)
			timerContainer.appendChild(timerElement)
		}

		// TODO: if startval does not change, keep timer visible?

		if (text.startsWith('00:')) {
			text = text.substr(3)
		} else if (text.startsWith('-00:')) {
			text = text.substr(4)
		}
		timerElement.innerText = text

		clearTimeout(timeouts[uid])
		timeouts[uid] = setTimeout(() => {
			const element = document.getElementById(uid)
			if(element) {
				element.remove()
			}
		}, 5000)
	}

	function updateVideo(uid, text) {
		if (localStorage.minimumVideoLengthForTimer === undefined) {
			localStorage.minimumVideoLengthForTimer = '00:01:00'
		}
		text = text.normalize()
		const isNewVideoTimer = text > lastKnownVideoTimerText
		if (isNewVideoTimer) {
			// A new timer since text is greater than before
			// If the video length is short, do not display a timer
			// To avoid timers for background videos.
			// TODO: Is there a way to improve this logic?
			if (text < localStorage.minimumVideoLengthForTimer) {
				console.log('text < localStorage.minimumVideoLengthForTimer')
				const videoTimer = document.getElementById('videoTimer')
				if(videoTimer) {
					videoTimer.remove()
				}
				return
			}
		}
		lastKnownVideoTimerText = text

		clearTimeout(timeouts['videoTimerlastKnownVideoTimerText'])
		timeouts['videoTimerlastKnownVideoTimerText'] = setTimeout(() => {
			// IF timer is not updated for some time
			lastKnownVideoTimerText = '00:00:00'
		}, 2000)

		updateTimer('videoTimer', text, 'Video')
	}

	function forceShowVideo() {
		lastKnownVideoTimerText = '99:99:99'
		timeouts['videoTimerlastKnownVideoTimerText'] = setTimeout(() => {
			// IF timer is not updated for some time
			lastKnownVideoTimerText = '00:00:00'
		}, 2000)
	}

	return {
		updateClock: updateClock,
		updateTimer: updateTimer,
		updateVideo: updateVideo,
		forceShowVideo: forceShowVideo,
	}
}
