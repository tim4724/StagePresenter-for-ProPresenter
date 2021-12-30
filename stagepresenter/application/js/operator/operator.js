"use strict"

function Operator() {
	const emptyPresentation = {
		"name": "No Presentation selected",
		"groups": [
			{
				"name": "",
				"slides": [
					{
						"rawText": "",
						"lines": [],
						"previewImage": "img/stagepresenter_banner.png"
					}
				],
				"hasLongTextLines": false
			}
		]
	}

	if (window.BroadcastChannel == undefined) {
		document.body.innerHTML = "Your Browser is not supported."
		return
	}

	const broadcastChannel = new BroadcastChannel('state')
	function reload() {
		broadcastChannel.postMessage({action: 'updateRequest'});
	}
	if (window.addEventListener) {
		window.addEventListener("storage", reload, false)
	} else {
		window.attachEvent("onstorage", reload)
	}

	const playlistSelect = document.getElementById('playlists')
	const presentationSelect = document.getElementById('presentations')
	const slideSelect = document.getElementById('slides')

	const clearPresentationButton = document.getElementById('clearPresentation')
	const prevPresentationButton = document.getElementById('previousPresentation')
	const nextPresentationButton = document.getElementById('nextPresentation')
	const slideUpButton = document.getElementById('slideUp')
	const slideDownButton = document.getElementById('slideDown')

	let currentPlaylists = []
	let latestConfirmedPlaylistIndex = undefined
	let latestConfirmedPlaylistItemIndex = undefined

	function prevPresentationOption() {
		for (let i = presentationSelect.selectedIndex - 1; i >= 0; i--) {
			const prevPresOption = presentationSelect.options[i]
			if (!prevPresOption.disabled && prevPresOption.style.display != 'None') {
				return presentationSelect.options[i]
			}
		}
		return undefined
	}

	function nextPresentationOption() {
		for (let i = presentationSelect.selectedIndex + 1; i < presentationSelect.length; i++) {
			if (!presentationSelect.options[i].disabled) {
				return presentationSelect.options[i]
			}
		}
		return undefined
	}

	function updateButtonsAndTooltips() {
		const currentPresentationOption = presentationSelect.querySelector('option:checked')
		clearPresentationButton.disabled = presentationSelect.value == "-1"
			&& currentPresentationOption.innerText == emptyPresentation.name

		const selectedPresentationIndex = presentationSelect.selectedIndex
		const presentationSelectCount = presentationSelect.options.length
		const prevPresOption = prevPresentationOption()
		const nextPresOption = nextPresentationOption()
		prevPresentationButton.disabled = prevPresOption == undefined
		nextPresentationButton.disabled = nextPresOption == undefined

		const selectedSlideIndex = slideSelect.selectedIndex
		const slideSelectCount = slideSelect.options.length
		slideUpButton.disabled = selectedSlideIndex <= 1
		slideDownButton.disabled = selectedSlideIndex >= slideSelectCount -1

		if (slideUpButton.disabled == false) {
			const prevSlideOption = slideSelect.options[selectedSlideIndex - 1]
			slideUpButton.style.color = prevSlideOption.getAttribute("color")
		} else {
			slideUpButton.style.color = ""
		}
		if (slideDownButton.disabled == false) {
			const nextSlideOption = slideSelect.options[selectedSlideIndex + 1]
			slideDownButton.style.color = nextSlideOption.getAttribute("color")
		} else {
			slideDownButton.style.color = ""
		}
		const prevPrsentationTooltip = prevPresentationButton.querySelector('.tooltiptext')
		if (prevPresOption != undefined) {
			const prevPresentationName = prevPresOption.innerText
			prevPrsentationTooltip.innerText = prevPresentationName
			prevPrsentationTooltip.style.display = ""
		} else {
			prevPrsentationTooltip.style.display = "none"
		}
		const nextPresentationTooltip = nextPresentationButton.querySelector('.tooltiptext')
		if (nextPresOption != undefined) {
			const nextPresentationName = nextPresOption.innerText
			nextPresentationTooltip.innerText = nextPresentationName
			nextPresentationTooltip.style.display = ""
		} else {
			nextPresentationTooltip.style.display = "none"
		}
	}

	playlistSelect.onchange = function(ev) {
		const playlistIndex = parseInt(ev.target.value)
		const playlist = currentPlaylists[playlistIndex]

		const currentPresentationName = presentationSelect.querySelector('option:checked').innerText

		if (playlistIndex == latestConfirmedPlaylistIndex) {
			setupPresentationSelect(playlist, latestConfirmedPlaylistItemIndex)
		} else {
			setupPresentationSelect(playlist, -1)
			const noneOptionElement = presentationSelect.querySelector('[value="-1"]')
			noneOptionElement.innerText = currentPresentationName
		}
		updateButtonsAndTooltips()
	}
	presentationSelect.onchange = function(ev) {
		changePlaylistItemIndex(parseInt(ev.target.value))
	}
	slideSelect.onchange = function(ev) {
		changeSlideIndex(parseInt(ev.target.value))
	}

	function buildOptionElement(text, value, selected) {
		const optionElement = document.createElement('option')
		optionElement.innerHTML = text
		optionElement.value = value
		optionElement.selected = selected
		return optionElement
	}

	function initSelect(selectElement) {
		const optionElement = buildOptionElement("None selected", "-1", false)
		optionElement.style.display = "none"
		// optionElement.disabled = true
		selectElement.appendChild(optionElement)
	}

	initSelect(playlistSelect)
	initSelect(presentationSelect)
	initSelect(slideSelect)

	function setupPlaylistSelect(playlists, playlistIndex) {
		playlistSelect.innerHTML = ''
		initSelect(playlistSelect)

		for (let i = 0; i < playlists.length; i++) {
			const name = playlists[i].name
			const selected = i === playlistIndex
			const optionElement = buildOptionElement(name, i, selected)
			playlistSelect.appendChild(optionElement)
		}
	}

	function setupPresentationSelect(playlist, playlistItemIndex) {
		presentationSelect.innerHTML = ''
		initSelect(presentationSelect)

		let currentOptGroupElement = undefined
		if (playlist != undefined && playlist.items != undefined) {
			presentationSelect.disabled = false
			for (let i = 0; i < playlist.items.length; i++) {
				const item = playlist.items[i]
				if (item.type == 'playlistItemTypeHeader') {
					currentOptGroupElement = document.createElement('optgroup')
					currentOptGroupElement.label = item.text
					presentationSelect.appendChild(currentOptGroupElement)
				} else {
					const selected = i === playlistItemIndex
					const optionElement = buildOptionElement(item.text, i, selected)
					const parent = currentOptGroupElement || presentationSelect
					parent.appendChild(optionElement)
				}
			}
		} else {
			presentationSelect.disabled = true
		}
	}

	function setupSlideSelect(presentation, slideIndex) {
		slideSelect.innerHTML = ''
		initSelect(slideSelect)
		slideSelect.style.borderColor = ''

		function toOptionElement(i) {
			return buildOptionElement("Slide " + (i + 1), i, i === slideIndex)
		}

		if (presentation && !isEqual(presentation, emptyPresentation)) {
			slideSelect.disabled = false
			let i = 0;
			for (const group of presentation.groups) {
				if (group.name.length > 0 && presentation.groups.length > 1) {
					const optGroupElement = document.createElement('optgroup')
					optGroupElement.label = group.name
					for (const slide of group.slides) {
						const optionElement = toOptionElement(i)
						optionElement.setAttribute('color', group.color);
						optGroupElement.appendChild(optionElement)
						i++;
					}
					slideSelect.appendChild(optGroupElement)
				} else {
					for (const slide of group.slides) {
						slideSelect.appendChild(toOptionElement(i))
						i++;
					}
				}
			}
		} else {
			slideSelect.disabled = true
		}
	}

	function changeOption(selectElement, value) {
		const oldOption = selectElement.querySelector('option:checked')
		const newOption = selectElement.querySelector('[value="' + value + '"]')
		if (oldOption != undefined) {
			oldOption.selected = false
		}
		if (newOption != undefined) {
			newOption.selected = true
		}
	}

	broadcastChannel.onmessage = (ev) => {
		const action = ev.data.action
		const value = ev.data.value
		console.log("onmessage", ev.data)
		switch (action) {
			case 'stateUpdate':
				const state = value
				// Unpack state
				currentPlaylists = state.currentPlaylists
				latestConfirmedPlaylistIndex = state.currentPlaylistIndex
				setupPlaylistSelect(currentPlaylists, state.currentPlaylistIndex)
				const pl = currentPlaylists[state.currentPlaylistIndex]
				latestConfirmedPlaylistItemIndex = state.currentPlaylistItemIndex
				setupPresentationSelect(pl, state.currentPlaylistItemIndex)
				setupSlideSelect(state.currentPresentation, state.currentSlideIndex)
				break

			case 'playlists':
				currentPlaylists = value
				latestConfirmedPlaylistItemIndex = -1
				setupPlaylistSelect(currentPlaylists, -1)
				break

			case 'playlistIndexAndItemIndex':
				const playlist = currentPlaylists[value.playlistIndex]

				latestConfirmedPlaylistItemIndex = value.playlistItemIndex
				latestConfirmedPlaylistIndex = value.playlistIndex
				if (parseInt(playlistSelect.value) !== value.playlistIndex) {
					changeOption(playlistSelect, value.playlistIndex)
					setupPresentationSelect(playlist, value.playlistItemIndex)
				} else {
					changeOption(presentationSelect, value.playlistItemIndex)
				}
				break

			case 'presentationAndSlideIndex':
				const noneOptionElement = presentationSelect.querySelector('[value="-1"]')
				noneOptionElement.innerText = value.presentation.name
				setupSlideSelect(value.presentation, value.slideIndex)
				break

			case 'slideIndex':
				const plist2 = currentPlaylists[latestConfirmedPlaylistIndex]
				if (playlistSelect.value != latestConfirmedPlaylistIndex) {
					changeOption(playlistSelect, latestConfirmedPlaylistIndex)
					setupPresentationSelect(plist2, latestConfirmedPlaylistItemIndex)
				}
				changeOption(slideSelect, value)
				break
		}
		updateButtonsAndTooltips()
	}

	function changeSlideIndex(slideIndex) {
		broadcastChannel.postMessage({action: 'slideIndex', value: slideIndex});
	}

	function changePlaylistItemIndex(playlistItemIndex) {
		const playlistIndex = parseInt(playlistSelect.value)
		broadcastChannel.postMessage({
			action: 'playlistIndexAndItemIndex',
			value: {
				playlistIndex: playlistIndex,
				playlistItemIndex: playlistItemIndex,
			}
		});
	}

	return {
		requestState: () => {
			broadcastChannel.postMessage({action: 'updateRequest'});
		},
		prevSlide: () => {
			const slideIndex = parseInt(slideSelect.value) - 1
			if (slideIndex >= 0) {
				changeSlideIndex(slideIndex)
			}
		},
		nextSlide: () => {
			const slideIndex = parseInt(slideSelect.value) + 1
			const lastOption = slideSelect.options[slideSelect.options.length - 1]
			if (slideIndex <= parseInt(lastOption.value)) {
				changeSlideIndex(slideIndex)
			}
		},
		prevPresentation: () => {
			const prevOption = prevPresentationOption()
			if (prevOption != undefined) {
				changePlaylistItemIndex(parseInt(prevOption.value))
			}
		},
		nextPresentation: () => {
			const nextOption = nextPresentationOption()
			if (nextOption != undefined) {
				changePlaylistItemIndex(parseInt(nextOption.value))
			}
		},
		clearPresentation: () => {
			changePlaylistItemIndex('-1')
			broadcastChannel.postMessage({
				action: 'presentationAndSlideIndex',
				value: { presentation: emptyPresentation, slideIndex: -1 }
			})
		}
	}
}
