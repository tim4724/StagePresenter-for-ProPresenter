"use strict"

function LocalStorageObserver(localStorageChanged,
							  reloadPresentationCallback) {
	if (window.addEventListener) {
		window.addEventListener("storage", update, false)
	} else {
		window.attachEvent("onstorage", update)
	}

	const sidebarContainerElement = document.getElementById('sidebar')
	const clockElement = document.getElementById('clock')

	if (localStorage.alignLeftCharactersThreshold === undefined) {
		localStorage.alignLeftCharactersThreshold = 60
	}
	let alignLeftCharactersThreshold = localStorage.alignLeftCharactersThreshold
	let customCSS = undefined
	let oldFeatures = []
	let reloadPresentationTimeout = undefined
	let localStorageChangedCallbackTimeout = undefined

	const style = document.createElement("style");
	document.head.appendChild(style);

	function update() {
		if (localStorage.features === undefined) {
			// as also defined in settings_stagemonitor.js
			localStorage.features = 'flexibleSlides improveBiblePassages showSidebarBottom onlyFirstTextInSlide doNotShowDisabledSlides doNotShowSlideNotes'
		}
		if (localStorage.sidebarMaxSize === undefined) {
			localStorage.sidebarMaxSize = 150
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

		const oldFeatures = document.body.className.split(' ')
		document.body.className = localStorage.features

		const features = localStorage.features.split(' ')

		slideNotesContent.style.height = localStorage.slideNotesHeight + "px"

		if (getComputedStyle(sidebarContainerElement).position === 'absolute') {
			const clockWidth = clockElement.scrollWidth
			sidebarContainerElement.style.maxWidth = ''
			sidebarContainerElement.style.maxHeight = ''
		} else {
			if (features.includes('showSidebarBottom')) {
				sidebarContainerElement.style.maxWidth = ''
				sidebarContainerElement.style.maxHeight = localStorage.sidebarMaxSize + 'px'
			} else if (features.includes('showSidebarLeft')) {
				sidebarContainerElement.style.maxWidth = localStorage.sidebarMaxSize + 'px'
				sidebarContainerElement.style.maxHeight = ''
			} else {
				sidebarContainerElement.style.maxWidth = ''
				sidebarContainerElement.style.maxHeight = ''
			}
		}

		style.innerText = ''
		let fontSizesStyle = ""
		if (localStorage.presentationFontSize) {
			const fontSize = localStorage.presentationFontSize / 100
			fontSizesStyle += ".group:not(.groupWithText) { font-size: " + fontSize + "em }"
		}
		if (localStorage.slideNotesFontSize) {
			const fontSize = localStorage.slideNotesFontSize / 100
			fontSizesStyle += "#slideNotes { font-size: " + (5 * fontSize) + "em }"
		}
		const groupWithTextFontSize = (localStorage.presentationLongTextFontSize || 80) / 100
		fontSizesStyle += ".group.groupWithText { font-size: " + groupWithTextFontSize + "em }"
		if (localStorage.timerFontSize) {
			const fontSize = localStorage.timerFontSize / 100
			fontSizesStyle += "#timerContainer { font-size: " + fontSize + "em }"
			fontSizesStyle += "#clock { font-size: " + fontSize + "em }"
		}
		if (localStorage.playlistFontSize) {
			const fontSize = localStorage.playlistFontSize / 100
			fontSizesStyle += "#playlist { font-size: " + fontSize + "em }"
		}
		if (fontSizesStyle.length > 0) {
			style.appendChild(document.createTextNode(fontSizesStyle))
		}

		if (localStorage.previewImageHeight) {
			const heightInPx = parseInt(localStorage.previewImageHeight)
			if(Number.isInteger(heightInPx)) {
				style.appendChild(document.createTextNode(
					".group img {height: " + heightInPx + "px;}"))
			}
		}
		if (localStorage.customCSS) {
			style.appendChild(document.createTextNode(localStorage.customCSS))
		}


		window.dispatchEvent(new Event('styleChanged'))

		clearTimeout(reloadPresentationTimeout)
		reloadPresentationTimeout = setTimeout(reloadPresentationIfNecessary, 32)
		clearTimeout(localStorageChangedCallbackTimeout)
		localStorageChangedCallbackTimeout = setTimeout(localStorageChanged, 1000)
	}

	function reloadPresentationIfNecessary() {
		const features = localStorage.features.split(' ')

		const importantFeatures = ['onlyFirstTextInSlide', 'improveBiblePassages', 'doNotShowSlideNotes', 'showSlideNotes', 'slideNotesReplaceSlideContent']
		if (importantFeatures.some(f => oldFeatures.includes(f) !== features.includes(f))
				|| alignLeftCharactersThreshold !== localStorage.alignLeftCharactersThreshold) {
			reloadPresentationCallback()
		}

		oldFeatures = document.body.className.split(' ')
		alignLeftCharactersThreshold = localStorage.alignLeftCharactersThreshold
		customCSS = localStorage.customCSS
	}

	requestAnimationFrame(function() {
		update()
		// Do note reload presentation on initial load...
		clearTimeout(reloadPresentationTimeout)
		clearTimeout(localStorageChangedCallbackTimeout)
	})
}
