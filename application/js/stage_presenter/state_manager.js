function StateManager(stateBroadcastChannel) {
	const presentationDomUpdater = PresentationDomUpdater()
	const playlistDomUpdater = PlaylistDomUpdater()
	const messageDomUpdater = MessageDomUpdater()

	let currentPlaylists = []
	let currentPlaylistIndex = -1
	let currentPlaylistItemIndex = -1

	let currentPresentation = undefined
	let currentPresentationPath = ''

	let currentSlideIndex = -1
	let currentSlideCleared = false

	let stageMessage = undefined

	function getState() {
		return {
			currentPlaylists: currentPlaylists,
			currentPlaylistIndex: currentPlaylistIndex,
			currentPlaylistItemIndex: currentPlaylistItemIndex,
			currentPresentation: currentPresentation,
			currentPresentationPath: currentPresentationPath,
			currentSlideIndex: currentSlideIndex,
			currentSlideCleared: currentSlideCleared,
			stageMessage: stageMessage,
		}
	}

	function getPlaylist(playlistIndex) {
		if (currentPlaylists.length === 1) {
			return currentPlaylists[0]
		} else {
			return currentPlaylists[playlistIndex]
		}
	}

	function updatePlaylistAndNextTitle(playlistIndex) {
		let playlist = getPlaylist(playlistIndex)

		if (playlist == undefined) {
			// Clear Playlist and next presentation title
			currentPlaylistIndex = -1
			currentPlaylistItemIndex = -1
			playlistDomUpdater.clear()
			presentationDomUpdater.clearNextPresentationTitle()
		} else {
			const playlistItemIndex = playlist.items.findIndex(i => i.location === currentPresentationPath)
			if (playlistIndex !== currentPlaylistIndex || playlistItemIndex !== currentPlaylistItemIndex) {
				if (playlistIndex != currentPlaylistIndex) {
					// Change whole playlist
					playlistDomUpdater.displayPlaylist(playlist, playlistItemIndex)
				} else {
					// Change current item in playlist
					playlistDomUpdater.changeCurrentItemAndScroll(playlistItemIndex)
				}

				if (playlistItemIndex >= 0 && playlistItemIndex + 1 < playlist.items.length) {
					const nextItem = playlist.items[playlistItemIndex + 1]
					presentationDomUpdater.setNextPresentationTitle(nextItem.text)
				} else {
					presentationDomUpdater.clearNextPresentationTitle()
				}

				currentPlaylistIndex = playlistIndex
				currentPlaylistItemIndex = playlistItemIndex
			}
		}

		if (stateBroadcastChannel !== undefined) {
			stateBroadcastChannel.postMessage({
				action: 'playlistIndexAndItemIndex',
				value: {
					playlistIndex: currentPlaylistIndex,
					playlistItemIndex: currentPlaylistItemIndex
				}
			})
		}
	}

	function hasText(presentation) {
		return presentation.groups.some(g => g.slides.some(s => s.lines.some(l => l.length > 0)))
	}

	function onNewPlaylists(playlists) {
		let playlistIndex = currentPlaylistIndex
		currentPlaylists = playlists
		currentPlaylistIndex = -1

		if (stateBroadcastChannel !== undefined) {
			stateBroadcastChannel.postMessage({action: 'playlists', value: playlists})
		}

		updatePlaylistAndNextTitle(playlistIndex)
	}

	function onNewPresentation(presentation, path, animate = true) {
		currentPresentation = presentation
		currentPresentationPath = path

		const playlistIndex = currentPlaylists.findIndex(p => path.startsWith(p.location))
		updatePlaylistAndNextTitle(playlistIndex >= 0 ? playlistIndex : currentPlaylistIndex)

		// Update presentation
		presentationDomUpdater.displayPresentation(presentation, currentSlideIndex, animate)
		if (stateBroadcastChannel !== undefined) {
			stateBroadcastChannel.postMessage({action: 'presentationAndSlideIndex', value: {
				presentation: presentation,
				slideIndex: currentSlideIndex
			}})
		}
	}

	function onNewMediaPresentation(name, presentationPath) {
		renderPreviewImage('Media', name, 1920, 1080, (previewImage => {
			const slide = Slide('', previewImage, [], undefined, undefined, false, [])
			const group = Group('', '', [slide])
			const animate = currentPresentation == undefined || currentPresentation.name !== name
			currentSlideIndex = 0
			onNewPresentation(Presentation('', [group]), presentationPath, animate)
		}))
	}

	function onNewSlideIndex(presentationPath, index, animate = true) {
		currentSlideIndex = index
		currentSlideCleared = false

		if (currentPresentationPath === presentationPath) {
			presentationDomUpdater.changeCurrentSlideAndScroll(index, animate)
			if (stateBroadcastChannel !== undefined) {
				stateBroadcastChannel.postMessage({action: 'slideIndex', value: index})
			}
		} else {
			// Wait till presentation is loaded...
			console.log("Do not change current slide, first load presentation")
		}
	}

	function clearSlideIndex(animate = true) {
		if (stateBroadcastChannel !== undefined) {
			stateBroadcastChannel.postMessage({action: 'clearSlideIndex', value: undefined})
		}
		currentSlideCleared = true
		presentationDomUpdater.changeCurrentSlideAndScroll(-1, animate)
	}

	function onNewMessage(text) {
		stageMessage = text
		messageDomUpdater.updateMessage(stageMessage)
	}

	if (stateBroadcastChannel !== undefined) {
		const state = getState()
		stateBroadcastChannel.postMessage({ action: 'stateUpdate', value: state })
	}

	return {
		onNewPlaylists: onNewPlaylists,
		onNewPresentation: onNewPresentation,
		onNewMediaPresentation: onNewMediaPresentation,
		onNewSlideIndex: onNewSlideIndex,
		clearSlideIndex: clearSlideIndex,
		onNewMessage: onNewMessage,
		getPlaylist: getPlaylist,
		getCurrentPlaylistIndex: () => currentPlaylistIndex,
		getCurrentPlaylistItemIndex: () => currentPlaylistItemIndex,
		getCurrentPresentationPath: () => currentPresentationPath,
		getCurrentPresentation: () => currentPresentation,
		getCurrentSlideIndex: () => currentSlideIndex,
		getState: getState,
	}
}
