function StateManager(stateBroadcastChannel) {
	const presentationDomUpdater = PresentationDomUpdater()
	const playlistDomUpdater = PlaylistDomUpdater()
	const messageDomUpdater = MessageDomUpdater()
	const timerDomUpdater = TimerDomUpdater()
	const errorDomUpdater = ErrorDomUpdater()

	let currentPlaylists = []
	let currentPlaylistIndex = -1
	let currentPlaylistItemIndex = -1

	let currentPresentation = undefined
	let currentPresentationPath = ''

	let currentSlideIndex = -1
	let currentSlideCleared = false

	function getState() {
		return {
			currentPlaylists: currentPlaylists,
			currentPlaylistIndex: currentPlaylistIndex,
			currentPlaylistItemIndex: currentPlaylistItemIndex,
			currentPresentation: currentPresentation,
			currentPresentationPath: currentPresentationPath,
			currentSlideIndex: currentSlideIndex,
			currentSlideCleared: currentSlideCleared,
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
			presentationDomUpdater.setNextPresentationTitle(undefined)
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

				let nextPresentationTitle = undefined
				const disableMediaItems = localStorage.features.split(' ').includes('skipMediaPlaylistItems')
				for (let i = playlistItemIndex + 1; i < playlist.items.length; i++) {
					const nextItem = playlist.items[i]
					if (nextItem.type != 'playlistItemTypeHeader' && (!disableMediaItems || nextItem.type != 'playlistItemTypeVideo')) {
						nextPresentationTitle = nextItem.text
						break
					}
				}
				presentationDomUpdater.setNextPresentationTitle(nextPresentationTitle)

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

	function onNewPlaylists(playlists) {
		let playlistIndex = 0
		if (playlists.length == 1) {
			playlistIndex = 0
		} else {
			playlistIndex = currentPlaylistIndex
		}
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
		timerDomUpdater.forceShowVideo()
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
		// TODO: Cache values, when relevant for preview window
		messageDomUpdater.updateMessage(text)
	}

	function onNewClock(seconds) {
		// TODO: Cache values, when relevant for preview window
		timerDomUpdater.updateClock(seconds)
	}

	function onNewTimer(uid, text, timerMode) {
		// TODO: Cache values, when relevant for preview window
		timerDomUpdater.updateTimer(uid, text, timerMode)
	}

	function onNewVideoCountdown(uid, text) {
		// TODO: Cache values, when relevant for preview window
		timerDomUpdater.updateVideo(uid, text)
	}

	function onNewConnectionErrors(remoteWebsocketConnectionState, stageWebsocketConnectionState) {
		// TODO: Cache values, when relevant for preview window
		errorDomUpdater.updateConnectionErrors(remoteWebsocketConnectionState, stageWebsocketConnectionState)
	}

	function clearConnectionErrors() {
		// TODO: Cache 'clear', when relevant for preview window
		errorDomUpdater.clearConnectionErrors()
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
		onNewClock: onNewClock,
		onNewTimer: onNewTimer,
		onNewVideoCountdown: onNewVideoCountdown,
		onNewConnectionErrors: onNewConnectionErrors,
		clearConnectionErrors: clearConnectionErrors,
		getPlaylist: getPlaylist,
		getCurrentPlaylistIndex: () => currentPlaylistIndex,
		getCurrentPlaylistItemIndex: () => currentPlaylistItemIndex,
		getCurrentPresentationPath: () => currentPresentationPath,
		getCurrentPresentation: () => currentPresentation,
		getCurrentSlideIndex: () => currentSlideIndex,
		getState: getState,
	}
}
