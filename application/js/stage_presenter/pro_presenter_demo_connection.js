function ProPresenterDemoConnection(stateManager) {
	let presentationSong = {
		"name": "One thing remains",
		"groups": [
			{
				"name": "Chorus",
				"color": "rgba(215.9409686923027, 35.055064558982856, 96.31569653749466, 255)",
				"slides": [
					{
						"rawText": "Your love never fails, \nIt never gives up",
						"lines": ["Your love never fails","It never gives up"]
					},
					{
						"rawText": "It never runs out on me",
						"lines": ["It never runs out on me"]
					}
				]
			},
			{
				"name": "Bridge",
				"color": "rgba(138.70549231767654, 45.39075314998627, 213.78469079732895, 255)",
				"slides": [
					{
						"rawText": "In death, in life, I'm confident and covered by",
						"lines": ["In death, in life, I'm confident and covered by"]
					},
					{
						"rawText": "The power of your great love",
						"lines": ["The power of your great love"]
					},
					{
						"rawText": "My debt is paid, There's nothing that can separate",
						"lines": ["My debt is paid, There's nothing that can separate"]
					},
					{
						"rawText": "My heart from your great love",
						"lines": ["My heart from your great love"]
					}
				]
			}
		]
	}
	let presentationBible = {
		"name": "John 3:16 (KJV)",
		"groups": [
			{
				"name": "John 3:16",
				"slides": [
					{
						"rawText": "John 3:16 (KJV)\r16For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.",
						"lines": ["For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life."],
						"label": "John 3:16",
						"isBiblePassage": true,
						"bibleVerseNumbers": ["16"]
					}
				],
				"hasLongTextLines": true
			}
		]
	}
	const mediaPresentationName = 'Video'
	const playlist = Playlist(
		'Playlist',
		[
			PlaylistItem('Worship', 'playlistItemTypeHeader', '0:0'),
			PlaylistItem(presentationSong.name, 'playlistItemTypePresentation', '0:1'),
			PlaylistItem('Sermon', 'playlistItemTypeHeader', '0:2'),
			PlaylistItem(presentationBible.name, 'playlistItemTypePresentation', '0:3'),
			PlaylistItem(mediaPresentationName, 'playlistItemTypeVideo', '0:4')
		],
		'0'
	)
	const connectionStatusElement = document.getElementById("connectionStatus")

	function loadPresentationJSONs(doneCallback) {
		fetch('json/one_thing_remains.json').then(response => {
			if (response.ok) {
				return response.json()
			} else {
				console.log("Failed to load song presentation")
				return new Promise(function(resolve, reject) {
					resolve(presentationSong)
				})
			}
		}).then((oneThingRemainsJSON) => {
			presentationSong = oneThingRemainsJSON
			return fetch('json/john_3_16_kjv.json')
		}).then(response => {
			if (response.ok) {
				return response.json()
			} else {
				console.log("Failed to load bible presentation")
				return new Promise(function(resolve, reject) {
					resolve(presentationBible)
				})
			}
		}).then((john316JSON) => {
			presentationBible = john316JSON
			doneCallback()
		})
	}

	function connect() {
		setInterval(function() {
			const seconds = 0 | (Date.now() / 1000)
			stateManager.onNewClock(seconds)
		}, 500);

		loadPresentationJSONs(function() {
			stateManager.onNewPlaylists([playlist])

			function nextAction() {
				let timeout = 3000

				const currentPresentation = stateManager.getCurrentPresentation()

				let scrollToSlideIndex = undefined
				if (currentPresentation != undefined) {
					const nextSlideIndex = stateManager.getCurrentSlideIndex() + 1
					if (nextSlideIndex < currentPresentation.groups.map(g => g.slides).flat().length) {
						scrollToSlideIndex = nextSlideIndex
					}
				}

				if (scrollToSlideIndex != undefined) {
					// Scroll slide
					const path = stateManager.getCurrentPresentationPath()
					stateManager.onNewSlideIndex(path, scrollToSlideIndex, true)
					timeout = 3000
				} else {
					// Switch Playlist item
					const currentPresentationPath = stateManager.getCurrentPresentationPath()
					switch (currentPresentationPath) {
						case '0:1':
							timeout = 6000
							loadPresentation('0:3')
							break
						case '0:3':
							timeout = 9000
							stateManager.onNewMediaPresentation(mediaPresentationName, '0:4')

							let videoCountDown = 8
							stateManager.onNewVideoCountdown('', '00:00:0' + videoCountDown)
							let videoInterval = setInterval(function() {
								videoCountDown -= 1
								if (stateManager.getCurrentPresentationPath() == '0:4' && videoCountDown >= 0) {
									stateManager.onNewVideoCountdown('', '00:00:0' + videoCountDown)
								} else {
									clearInterval(videoInterval)
									stateManager.onNewVideoCountdown('', '')
								}
							}, 1000)
							break
						default:
							timeout = 2000
							loadPresentation('0:1')
					}
				}

				setTimeout(nextAction, timeout)
			}
			setTimeout(nextAction, 1500)
		})
	}

	function loadPresentation(presentationPath) {
		let presentation = undefined
		if (presentationPath == '0:1') {
			presentation = presentationSong
		} else if(presentationPath == '0:3') {
			presentation = presentationBible
		}
		if (presentation != undefined) {
			const oldPres = stateManager.getCurrentPresentation()
			const animate = (oldPres == undefined || oldPres.name !== presentation.name)
			stateManager.onNewPresentation(presentation, presentationPath, animate)
		}
	}

	return {
		connect: connect,
		loadPresentation: loadPresentation,
		reloadCurrentPresentation: () => loadPresentation(stateManager.getCurrentPresentationPath())
	}
}
