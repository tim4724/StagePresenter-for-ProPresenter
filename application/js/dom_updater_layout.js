"use strict"

function LayoutDomUpdater() {
	let updateTimout = undefined
	function callUpdateAfterTimout() {
		clearTimeout(updateTimout)
		updateTimout = setTimeout(update, 500)
	}
	if (window.addEventListener) {
		window.addEventListener("storage", callUpdateAfterTimout, false)
	} else {
		window.attachEvent("onstorage", callUpdateAfterTimout)
	}

	const body = document.body
	const sidebarContainerElement = document.getElementById('sidebar')
	const nextUpContainerElement = document.getElementById('nextUpContainer')
	const clockElement = document.getElementById('clock')

	if (localStorage.alignLeftCharactersThreshold === undefined) {
		localStorage.alignLeftCharactersThreshold = 60
	}
	let alignLeftCharactersThreshold = localStorage.alignLeftCharactersThreshold

	function update() {
		if (localStorage.features === undefined) {
			localStorage.features = 'flexibleSlides improveBiblePassages showSidebarBottom onlyFirstTextInSlide'
        }
		if (localStorage.sidebarMaxSize === undefined) {
			localStorage.sidebarMaxSize = 150
		}

		const oldFeatures = body.className.split(' ')
		body.className = localStorage.features
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

		const parsingFeatures = ['onlyFirstTextInSlide', 'improveBiblePassages']
		if (parsingFeatures.some(f => oldFeatures.includes(f) !== features.includes(f))
				|| alignLeftCharactersThreshold !== localStorage.alignLeftCharactersThreshold) {
			proPresenter.reloadCurrentPresentation()
		}
		alignLeftCharactersThreshold = localStorage.alignLeftCharactersThreshold
	}
	requestAnimationFrame(update)
}
