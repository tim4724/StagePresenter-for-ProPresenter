function StagePresenter() {
	const runningInElectron = !location.href.startsWith("http")
	function getHost() {
		if ((localStorage.demoMode || "true") == "true") {
			return 'demo'
		}
		return (localStorage.ipAddress || 'localhost') + ':' + (localStorage.port || '63147')
	}

	let host = getHost()
	let stateBroadcastChannel = undefined
	if (runningInElectron && window.BroadcastChannel) {
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

	if (location.href.startsWith("http")) {
		document.title = "StagePresenter Demo"
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
	// No broadcast if not running in electron
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

					if (item.type != 'playlistItemTypePresentation') {
						const name = item.text
						let previewImage = ''
						switch (item.type) {
							// "playlistItemTypeImage" does not exist, tough it should??
							// Images are "playlistItemTypeVideo"
							case 'playlistItemTypeVideo':
							case 'playlistItemTypeAudio':
							case 'playlistItemTypeImage':
								previewImage = 'img/play_banner.png'
								break
							case 'playlistItemTypePlaceHolder':
							default:
								previewImage = 'img/circle_banner.png'
								break
						}
						const slide = Slide('', previewImage, [], undefined, undefined, "", false, [])
						const group = Group('', '', [slide])
						const p = Presentation(name, [group])
						stateManager.onNewPresentation(p, presentationPath)
					}

					stateManager.onNewSlideIndex(presentationPath, -1, true)
					proPresenterConnection.loadPresentation(presentationPath)
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
