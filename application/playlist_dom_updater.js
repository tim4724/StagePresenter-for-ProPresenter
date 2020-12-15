"use strict"

function PlaylistDomUpdater() {
	const playlistContainerElement = document.getElementById('playlist')
	const playlistNameElement = document.getElementById('playlistName')
	
	window.onresize = onresize
	if (ResizeObserver) {
		new ResizeObserver(onresize).observe(playlistContainerElement)
	}

	let onResizeTimout = undefined
	function onresize() {
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
				if (itemForHeaderCounter > 1 || i + 1 >= playlist.items || !playlist.items[i + 1].isHeader) {
					itemElement.innerText = itemForHeaderCounter + ' ' + item.text
				} else {
					// Single item under header, do not display a number
					itemElement.innerText = item.text
				}
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
	
	function changeCurrentItemAndScroll(index) {
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
		scrollToCurrentItem()
	}
	
	function scrollToCurrentItem(animate = true) {
		const item = playlistContainerElement.querySelector('.playlistCurrent')
		if (!item) {
			return
		}
		item.scrollIntoView({
			behavior: animate ? 'smooth' : 'auto',
			block: 'center',
			inline: 'center'
		});
	}
	
	return {
		displayPlaylist: displayPlaylist,
		changeCurrentItemAndScroll: changeCurrentItemAndScroll,
		clear: clear
	}
}