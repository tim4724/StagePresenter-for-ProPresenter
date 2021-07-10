"use strict"

function LocalStorageObserver(localStorageChanged,
							  reloadPresentationCallback) {
	if (window.addEventListener) {
		window.addEventListener("storage", update, false)
	} else {
		window.attachEvent("onstorage", update)
	}

	const sidebarContainerElement = document.getElementById('sidebar')
	const nextUpElement = document.getElementById('nextUp')
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
			localStorage.features = 'flexibleSlides improveBiblePassages showSidebarBottom onlyFirstTextInSlide doNotShowDisabledSlides'
		}
		if (localStorage.sidebarMaxSize === undefined) {
			localStorage.sidebarMaxSize = 150
		}

		const oldFeatures = document.body.className.split(' ')
		document.body.className = localStorage.features

		const features = localStorage.features.split(' ')

		if (getComputedStyle(sidebarContainerElement).position === 'absolute') {
			const clockWidth = clockElement.scrollWidth
			nextUpElement.style.right = clockWidth + 'px'
			sidebarContainerElement.style.maxWidth = ''
			sidebarContainerElement.style.maxHeight = ''
		} else {
			nextUpElement.style.right = ''

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
		if (localStorage.customCSS) {
			style.appendChild(document.createTextNode(localStorage.customCSS))
		}

		window.dispatchEvent(new Event('styleChanged'))

		clearTimeout(reloadPresentationTimeout)
		reloadPresentationTimeout = setTimeout(reloadPresentationIfNecessary, 500)
		clearTimeout(localStorageChangedCallbackTimeout)
		localStorageChangedCallbackTimeout = setTimeout(localStorageChanged, 1000)
	}

	function reloadPresentationIfNecessary() {
		const features = localStorage.features.split(' ')

		const importantFeatures = ['onlyFirstTextInSlide', 'improveBiblePassages']
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
