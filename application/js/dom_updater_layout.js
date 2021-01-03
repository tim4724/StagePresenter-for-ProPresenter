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
		const flexibleSlides = localStorage.flexibleSlides !== 'false'
		setFeature('flexibleSlides', flexibleSlides)

		const showSidebar = localStorage.showSidebar !== 'false'
		setFeature('showSidebar', showSidebar)

		const showClockRight = localStorage.showClockRight === 'true'

		const sidebar = document.getElementById('sidebar')
		const clockInSidebar = sidebar.querySelector('#clock')
		if (showClockRight && clockInSidebar) {
			clockInSidebar.remove()
			document.body.appendChild(clockInSidebar)
		} else if (!showClockRight && !clockInSidebar) {
			const clock = document.getElementById('clock')
			clock.remove()
			sidebar.insertBefore(clock, sidebar.children[0]);
		}
	}
	update()
}
