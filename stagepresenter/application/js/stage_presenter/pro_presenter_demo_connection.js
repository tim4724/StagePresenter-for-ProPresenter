function ProPresenterDemoConnection(stateManager) {
	let presentationSong = {
	    "name": "Amazing Grace",
	    "groups": [
	        {
	            "name": "Chorus",
	            "color": "rgba(215.9409686923027, 35.055064558982856, 96.31569653749466, 255)",
	            "slides": [
	                {
	                    "rawText": "Amazing Grace, how sweet the sound\nThat saved a wretch like me",
	                    "lines": ["Amazing Grace, how sweet the sound", "That saved a wretch like me"
	                    ]
	                },
	                {
	                    "rawText": "I once was lost, but now am found\nWas blind but now I see",
	                    "lines": ["I once was lost, but now am found", "Was blind but now I see"]
	                }
	            ]
	        },
	        {
	            "name": "Verse 1",
	            "color": "rgba(0, 140.00479459762573, 213.7954518198967, 255)",
	            "slides": [
	                {
	                    "rawText": "Was Grace that taught my heart to fear\nAnd Grace, my fears relieved",
	                    "lines": ["Was Grace that taught my heart to fear", "And Grace, my fears relieved"],
	                },
	                {
	                    "rawText": "How precious did that Grace appear\nThe hour I first believed",
	                    "lines": ["How precious did that Grace appear", "The hour I first believed"]
	                },
	                {
	                    "rawText": "Through many dangers, toils and snares\nWe have already come",
	                    "lines": ["Through many dangers, toils and snares", "We have already come"]
	                },
	                {
	                    "rawText": "T'was Grace that brought us safe thus far\nAnd Grace will lead us home\nAnd Grace will lead us home",
	                    "lines": ["T'was Grace that brought us safe thus far", "And Grace will lead us home", "And Grace will lead us home"]
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
	const presentationImageSlide = {
		"name": "Presentation",
		"groups": [
			{
				"name": "",
				"slides": [
					{
						"rawText": "",
						"lines": [],
						"previewImage": "img/banner16x9.png"
					}
				],
				"hasLongTextLines": true
			}
		]
	}
	const mediaPresentationName = 'Some Video.mp4'
	const playlist = Playlist(
		'Playlist',
		[
			PlaylistItem('Worship', 'playlistItemTypeHeader', '0:0'),
			PlaylistItem(presentationSong.name, 'playlistItemTypePresentation', '0:1'),
			PlaylistItem('Sermon', 'playlistItemTypeHeader', '0:2'),
			PlaylistItem(presentationImageSlide.name, 'playlistItemTypePresentation', '0:3'),
			PlaylistItem(mediaPresentationName, 'playlistItemTypeVideo', '0:4'),
			PlaylistItem(presentationBible.name, 'playlistItemTypePresentation', '0:5')
		],
		'0'
	)
	const connectionStatusElement = document.getElementById("connectionStatus")

	function loadPresentationJSONs(doneCallback) {
		fetch('json/amazing_grace.json').then(response => {
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
		connectionStatusElement.innerText = "Connected"
		connectionStatusElement.classList.add('success')

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
						case '0:4':
							timeout = 6000
							loadPresentation('0:5')
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
			presentation = presentationImageSlide
		} else if(presentationPath == '0:5') {
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
