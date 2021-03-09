"use strict"

function Operator() {
    const broadcastChannel = new BroadcastChannel('state')
    const playlistSelect = document.getElementById('playlists')
    const presentationSelect = document.getElementById('presentations')
    const slideSelect = document.getElementById('slides')
    let currentPlaylists = []

    playlistSelect.onchange = function(ev) {
        const currentPresentationOption = presentationSelect.querySelector('option:checked')

        const playlistIndex = parseInt(ev.target.value)
        const playlist = currentPlaylists[playlistIndex]
        setupPresentationSelect(playlist, -1)

        const noneOptionElement = presentationSelect.querySelector('[value="-1"]')
        noneOptionElement.innerText = currentPresentationOption.innerText
    }
    presentationSelect.onchange = function(ev) {
        changePlaylistItemIndex(parseInt(ev.target.value))
    }
    slideSelect.onchange = function(ev) {
        changeSlideIndex(parseInt(ev.target.value))
    }

    function buildOptionElement(text, value, selected) {
        const optionElement = document.createElement('option')
        optionElement.innerText = text
        optionElement.value = value
        optionElement.selected = selected
        return optionElement
    }

    function initSelect(selectElement) {
        const optionElement = buildOptionElement("None selected", "-1", false)
        optionElement.style.display = "none"
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
        }
    }

    function setupSlideSelect(presentation, slideIndex) {
        slideSelect.innerHTML = ''
        initSelect(slideSelect)
        slideSelect.style.borderColor = ''

        if (presentation != undefined) {
            let i = 0;
            for (const group of presentation.groups) {
                const optGroupElement = document.createElement('optgroup')
                optGroupElement.label = group.name
                for (const slide of group.slides) {
                    const selected = i === slideIndex
                    const name = "Slide " + (i + 1)
                    const optionElement = buildOptionElement(name, i, selected)
                    optGroupElement.appendChild(optionElement)
                    i++;
                }
                slideSelect.appendChild(optGroupElement)
            }
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

    let latestConfirmedPlaylistIndex = undefined
    let latestConfirmedPlaylistItemIndex = undefined
    broadcastChannel.onmessage = (ev) => {
        const action = ev.data.action
        const value = ev.data.value

        switch (action) {
            case 'stateUpdate':
                const state = value
                // Unpack state
                currentPlaylists = state.currentPlaylists
                latestConfirmedPlaylistIndex = state.currentPlaylistIndex
                setupPlaylistSelect(currentPlaylists, state.currentPlaylistIndex)
                const playlist = currentPlaylists[state.currentPlaylistIndex]
                latestConfirmedPlaylistItemIndex = state.currentPlaylistItemIndex
                setupPresentationSelect(playlist, state.currentPlaylistItemIndex)
                setupSlideSelect(state.currentPresentation, state.currentSlideIndex)
                break

            case 'playlists':
                currentPlaylists = value
                latestConfirmedPlaylistItemIndex = -1
                setupPlaylistSelect(currentPlaylists, -1)
                break

            case 'playlistIndexAndItemIndex':
                latestConfirmedPlaylistItemIndex = value.playlistItemIndex
                if (parseInt(playlistSelect.value) !== value.playlistIndex) {
                    latestConfirmedPlaylistIndex = value.playlistIndex
                    changeOption(playlistSelect, value.playlistIndex)
                    const playlist = currentPlaylists[value.playlistIndex]
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
                if (playlistSelect.value != latestConfirmedPlaylistIndex) {
                    changeOption(playlistSelect, latestConfirmedPlaylistIndex)
                    const playlist = currentPlaylists[latestConfirmedPlaylistIndex]
                    setupPresentationSelect(playlist, latestConfirmedPlaylistItemIndex)
                }
                changeOption(slideSelect, value)
                break
        }
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
            const presentationOptions = presentationSelect.querySelectorAll('option')
            const prevOption = presentationOptions[presentationSelect.selectedIndex - 1]
            if (prevOption != undefined) {
                changePlaylistItemIndex(parseInt(prevOption.value))
            }
        },
        nextPresentation: () => {
            const presentationOptions = presentationSelect.querySelectorAll('option')
            const nextOption = presentationOptions[presentationSelect.selectedIndex + 1]
            if (nextOption != undefined) {
                changePlaylistItemIndex(parseInt(nextOption.value))
            }
        },
        clearPresentation: () => {
            broadcastChannel.postMessage({
                action: 'presentationAndSlideIndex',
                value: {
                    presentation: {
                		name: "No Presentation selected",
                		groups: [],
                	},
                    slideIndex: -1
                }
            })
        }
    }
}
