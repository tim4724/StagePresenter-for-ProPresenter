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

	function updatePlaylist(playlistIndex) {
		let playlist = getPlaylist(playlistIndex)

		if (!playlist) {
			// Clear Playlist and next presentation title
			currentPlaylistIndex = -1
			currentPlaylistItemIndex = -1
			playlistDomUpdater.clear()
		} else {
			function getAllIndices(array, check) {
				return array.map((e, i) => check(e) ? i : '').filter(String)
			}

			const items = playlist.items
			let playlistItemIndicesByName = []
			if (currentPresentation) {
				playlistItemIndicesByName = getAllIndices(items, i => i.text === currentPresentation.name)
			}
			const playlistItemIndexByPath = items.findIndex(i => i.location === currentPresentationPath)

			let playlistItemIndex = -1
			switch (playlistItemIndicesByName.length) {
				case 1:
					playlistItemIndex = playlistItemIndicesByName[0]
					break
				case 0:
					playlistItemIndex = playlistItemIndexByPath
					break
				default:
					const goal = playlistItemIndexByPath >= 0 ? playlistItemIndexByPath : currentPlaylistItemIndex
					playlistItemIndex = playlistItemIndicesByName.reduce(function(prev, curr) {
						return Math.abs(curr - goal) < Math.abs(prev - goal) ? curr : prev
					})
					break
			}

			if (playlistIndex !== currentPlaylistIndex || playlistItemIndex !== currentPlaylistItemIndex) {
				if (playlistIndex != currentPlaylistIndex) {
					// Change whole playlist
					playlistDomUpdater.displayPlaylist(playlist, playlistItemIndex)
				} else {
					// Change current item in playlist
					playlistDomUpdater.changeCurrentItemAndScroll(playlistItemIndex)
				}
				currentPlaylistIndex = playlistIndex
				currentPlaylistItemIndex = playlistItemIndex
			}
		}

		if (stateBroadcastChannel) {
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

		if (stateBroadcastChannel) {
			stateBroadcastChannel.postMessage({action: 'playlists', value: playlists})
		}

		updatePlaylist(playlistIndex)
	}

	function onNewPresentation(presentation, path, animate = true) {
		currentPresentation = presentation
		currentPresentationPath = path

		const playlistIndex = currentPlaylists.findIndex(p => path.startsWith(p.location))
		updatePlaylist(playlistIndex >= 0 ? playlistIndex : currentPlaylistIndex)

		// Update presentation
		presentationDomUpdater.displayPresentation(presentation, currentSlideIndex, animate)
		if (stateBroadcastChannel) {
			stateBroadcastChannel.postMessage({
				action: 'presentationAndSlideIndex',
				value: {
					presentation: presentation,
					slideIndex: currentSlideIndex
				}
			})
		}
	}

	function onNewSlideIndex(presentationPath, index, animate = true) {
		currentSlideIndex = index
		currentSlideCleared = false
		if (currentPresentationPath === presentationPath) {
			presentationDomUpdater.changeCurrentSlideAndScroll(index, animate)
			if (stateBroadcastChannel) {
				stateBroadcastChannel.postMessage({action: 'slideIndex', value: index})
			}
		} else {
			// Wait till presentation is loaded...
			console.log("Do not change current slide, first load presentation")
		}
		currentPresentationPath = presentationPath
	}

	function clearSlideIndex(animate = true) {
		if (stateBroadcastChannel) {
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

	function forceShowVideoCountdown() {
		timerDomUpdater.forceShowVideo()
	}

	if (stateBroadcastChannel) {
		const state = getState()
		stateBroadcastChannel.postMessage({ action: 'stateUpdate', value: state })
	}

	return {
		onNewPlaylists: onNewPlaylists,
		onNewPresentation: onNewPresentation,
		onNewSlideIndex: onNewSlideIndex,
		clearSlideIndex: clearSlideIndex,
		onNewMessage: onNewMessage,
		onNewClock: onNewClock,
		onNewTimer: onNewTimer,
		onNewVideoCountdown: onNewVideoCountdown,
		forceShowVideoCountdown: forceShowVideoCountdown,
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
