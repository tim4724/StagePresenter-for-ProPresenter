function StagePresenter() {
	function getHost() {
		if ((localStorage.demoMode || "true") == "true") {
			return 'demo'
		}
		return (localStorage.ipAddress || 'localhost') + ':' + (localStorage.port || '63147')
	}

	let host = getHost()
	let stateBroadcastChannel = undefined
	if (window.BroadcastChannel) {
		stateBroadcastChannel = new BroadcastChannel('state')
	}

	const stateManager = StateManager(stateBroadcastChannel)

	let proPresenterConnection = undefined
	if (host == 'demo') {
		document.getElementById('demoMode').style.display = "block"
		proPresenterConnection = ProPresenterDemoConnection(stateManager)
	} else {
		document.getElementById('demoMode').style.display = "none"
		proPresenterConnection = ProPresenterConnection(stateManager, host)
	}

	function issuePresentationReload() {
		proPresenterConnection.reloadCurrentPresentation()
	}

	function localStorageChangedCallback() {
		if (host != getHost()) {
			location.reload()
		}
	}

	const localStorageObserver = LocalStorageObserver(localStorageChangedCallback,
													  issuePresentationReload)

	if (stateBroadcastChannel !== undefined) {
		stateBroadcastChannel.onmessage = (ev) => {
			const action = ev.data.action
			const value = ev.data.value
			switch (action) {
				case 'updateRequest':
					const state = stateManager.getState()
					stateBroadcastChannel.postMessage({
						action: 'stateUpdate',
						value: state
					})
					break

				case 'playlistIndexAndItemIndex':
					const playlistIndex = value.playlistIndex
					const playlistItemIndex = value.playlistItemIndex
					const playlist = stateManager.getPlaylist(playlistIndex)
					if (playlist === undefined) {
						break
					}
					const item = playlist.items[playlistItemIndex]
					if (item == undefined) {
						break
					}
					const presentationPath = item.location
					if (item.type == 'playlistItemTypePresentation') {
						stateManager.onNewSlideIndex(presentationPath, -1, true)
						proPresenterConnection.loadPresentation(presentationPath)
					} else {
						// Only other known item type is
						// playlistItemTypeVideo (also for images)
						// Therefore show a media presentation
						const name = item.text
						stateManager.onNewMediaPresentation(name, presentationPath)
					}
					break

				case 'presentationAndSlideIndex':
					stateManager.onNewSlideIndex('', value.slideIndex, true)
					stateManager.onNewPresentation(value.presentation, '', true)
					break

				case 'slideIndex':
					if (stateManager !== undefined) {
						const presentationPath = stateManager.getCurrentPresentationPath()
						stateManager.onNewSlideIndex(presentationPath, value, true)
					}
					break
			}
		}
	}
	proPresenterConnection.connect()
}
