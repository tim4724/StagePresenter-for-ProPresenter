"use strict"

function LocalStorageObserver() {
	if (window.addEventListener) {
		window.addEventListener("storage", update, false)
	} else {
		window.attachEvent("onstorage", update)
	}

	const sidebarContainerElement = document.getElementById('sidebar')
	const nextUpContainerElement = document.getElementById('nextUpContainer')
	const clockElement = document.getElementById('clock')

	if (localStorage.alignLeftCharactersThreshold === undefined) {
		localStorage.alignLeftCharactersThreshold = 60
	}
	let alignLeftCharactersThreshold = localStorage.alignLeftCharactersThreshold
	let oldFeatures = []
	let reloadPresentationTimeout = undefined

	const style = document.createElement("style");
	document.head.appendChild(style);

	function update() {
		if (localStorage.features === undefined) {
			localStorage.features = 'flexibleSlides improveBiblePassages showSidebarBottom onlyFirstTextInSlide'
        }
		if (localStorage.sidebarMaxSize === undefined) {
			localStorage.sidebarMaxSize = 150
		}

		style.innerText = ''
		if (localStorage.presentationFontSize) {
			const fontSize = localStorage.presentationFontSize / 100
			style.appendChild(document.createTextNode(
				".group:not(.groupWithLongText) { font-size: " + fontSize + "em }"))
		}
		if (localStorage.presentationLongTextFontSize) {
			const fontSize = localStorage.presentationLongTextFontSize / 100
			style.appendChild(document.createTextNode(
				".group.groupWithLongText { font-size: " + fontSize + "em }"))
		}
		if (localStorage.timerFontSize) {
			const fontSize = localStorage.timerFontSize / 100
			style.appendChild (document.createTextNode (
				"#timerContainer { font-size: " + fontSize + "em }"))
			style.appendChild(document.createTextNode(
				"#clock { font-size: " + fontSize + "em }"))
		}
		if (localStorage.playlistFontSize) {
			const fontSize = localStorage.playlistFontSize / 100
			style.appendChild(document.createTextNode(
				"#playlist { font-size: " + fontSize + "em }"))
		}

		const oldFeatures = document.body.className.split(' ')
		document.body.className = localStorage.features
		const features = localStorage.features.split(' ')

		if (getComputedStyle(sidebarContainerElement).position === 'absolute') {
			const clockWidth = clockElement.scrollWidth
			nextUpContainerElement.style.right = clockWidth + 'px'
			sidebarContainerElement.style.maxWidth = ''
			sidebarContainerElement.style.maxHeight = ''
		} else {
			nextUpContainerElement.style.right = ''

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

		window.dispatchEvent(new Event('styleChanged'))

		clearTimeout(reloadPresentationTimeout)
		reloadPresentationTimeout = setTimeout(reloadPresentationIfNecessary, 500)
	}

	function reloadPresentationIfNecessary() {
		const features = localStorage.features.split(' ')

		const parsingFeatures = ['onlyFirstTextInSlide', 'improveBiblePassages']
		if (parsingFeatures.some(f => oldFeatures.includes(f) !== features.includes(f))
				|| alignLeftCharactersThreshold !== localStorage.alignLeftCharactersThreshold) {
			proPresenter.reloadCurrentPresentation()
		}

		alignLeftCharactersThreshold = localStorage.alignLeftCharactersThreshold
		oldFeatures = document.body.className.split(' ')
	}

	requestAnimationFrame(update)
}
