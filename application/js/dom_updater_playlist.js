"use strict"

function PlaylistDomUpdater() {
	const playlistContainerElement = document.getElementById('playlist')
	const playlistNameElement = document.getElementById('playlistName')
	const scroller = Scroller(playlistContainerElement)
	let containerTop = playlistContainerElement.getBoundingClientRect().top
	let containerCenterY = centerY(playlistContainerElement.getBoundingClientRect())

	if (ResizeObserver) {
		new ResizeObserver(entries => {
		   // Wrap in requestAnimationFrame to avoid "ResizeObserver loop limit exceeded"
		   requestAnimationFrame(() => {
			 if (!Array.isArray(entries) || !entries.length) {
			   return;
			 }
			 onresize()
		   });
		}).observe(playlistContainerElement)
	}
	window.addEventListener('styleChanged', onresize)

	let onResizeTimout = undefined
	function onresize() {
		containerTop = playlistContainerElement.getBoundingClientRect().top
		containerCenterY = centerY(playlistContainerElement.getBoundingClientRect())
		clearTimeout(onResizeTimout)
		onResizeTimout = setTimeout(scrollToCurrentItem, 500)
	}

	function displayPlaylist(playlist, index, animate=true) {
		clear()

		playlistNameElement.innerText = playlist.name
		let itemForHeaderCounter = 0
		for (let i = 0; i < playlist.items.length; i++) {
			const item = playlist.items[i]

			const itemElement = document.createElement("span")
			itemElement.classList.add('playlistItem')
			if (item.isHeader) {
				itemForHeaderCounter = 0
				itemElement.classList.add('playlistHeader')
				itemElement.innerText = item.text
			} else {
				itemForHeaderCounter++

				// Check if multipleElements are under header
				if (itemForHeaderCounter > 1 || i + 1 >= playlist.items || !playlist.items[i + 1].isHeader) {
					const itemIndexElement = document.createElement("span")
					itemIndexElement.innerText = itemForHeaderCounter
					itemIndexElement.classList.add('playlistItemIndex')
					itemElement.appendChild(itemIndexElement)
				}

				const itemTextElement = document.createElement("span")
				itemTextElement.innerText = item.text
				itemElement.appendChild(itemTextElement)
			}
			if (i == index) {
				itemElement.classList.add('playlistCurrent')
			}
			playlistContainerElement.appendChild(itemElement)
		}

		scrollToCurrentItem(animate)
	}

	function clear() {
		playlistNameElement.innerText = ''
		const playlistItemElements = playlistContainerElement.querySelectorAll('.playlistItem')
		playlistItemElements.forEach(e => e.parentElement.removeChild(e))
	}

	function changeCurrentItemAndScroll(index, animate = true) {
		const oldItem = playlistContainerElement.querySelector('.playlistCurrent')
		if (oldItem) {
			oldItem.classList.remove('playlistCurrent')
		}

		const playlistItemElements = playlistContainerElement.querySelectorAll('.playlistItem')
		if (!playlistItemElements) {
			return
		}

		const newItem = playlistItemElements[index]
		if (newItem) {
			newItem.classList.add('playlistCurrent')
		}
		scrollToCurrentItem(animate)
	}

	function scrollToCurrentItem(animate = true) {
		const item = playlistContainerElement.querySelector('.playlistCurrent')
		if (!item) {
			return
		}

		// TODO is there a better way to scroll (without getBoundingClientRect)?
		let deltaY
		if (playlistContainerElement.offsetHeight > 300) {
			const itemCenterY = centerY(item.getBoundingClientRect())
			deltaY = itemCenterY - containerCenterY
		} else {
			const itemTop = item.getBoundingClientRect().top
			deltaY = itemTop - containerTop
		}

		if (animate) {
			scroller.scroll(deltaY, 1200)
		} else {
			scroller.scroll(deltaY, 0)
		}
	}

	function centerY(boundingRect) {
		return boundingRect.top + (boundingRect.height / 2.0)
	}

	return {
		displayPlaylist: displayPlaylist,
		changeCurrentItemAndScroll: changeCurrentItemAndScroll,
		clear: clear
	}
}
