"use strict"

function LayoutDomUpdater() {
	const body = document.body
	if (window.addEventListener) {
		window.addEventListener("storage", update, false)
	} else {
		window.attachEvent("onstorage", update)
	}

	const sidebarContainerElement = document.getElementById('sidebar')
	const nextUpContainerElement = document.getElementById('nextUpContainer')
	const clockElement = document.getElementById('clock')

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
			} else {
				sidebarContainerElement.style.maxWidth = localStorage.sidebarMaxSize + 'px'
				sidebarContainerElement.style.maxHeight = ''
			}
		}

		if (oldFeatures.includes('onlyFirstTextInSlide') !==
				features.includes('onlyFirstTextInSlide')) {
			proPresenter.parserConfigChanged()
		}
		if (oldFeatures.includes('improveBiblePassages') !==
				features.includes('improveBiblePassages')) {
			proPresenter.parserConfigChanged()
		}
	}
	requestAnimationFrame(update)
}
