"use strict"

function LayoutDomUpdater() {
	const body = document.body
	if (window.addEventListener) {
		window.addEventListener("storage", update, false)
	} else {
		window.attachEvent("onstorage", update)
	}

	function setFeature(name, enable) {
		if(enable) {
			if (!body.classList.contains(name)) {
				body.classList.add(name)
			}
		} else {
			body.classList.remove(name)
		}
	}

	function update() {
		const flexibleSlides = localStorage['flexibleSlides'] !== 'false'
		setFeature('flexibleSlides', flexibleSlides)

		const showSidebar = localStorage['showSidebar'] !== 'false'
		setFeature('showSidebar', showSidebar)
	}
	update()
}
