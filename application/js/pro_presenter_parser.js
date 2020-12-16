"use strict"

function Playlist(name, items, location) {
	return {
		name: name,
		items: items,
		location: location
	}
}

function PlaylistItem(text, isHeader, location) {
	return {
		text: text,
		isHeader: isHeader,
		location: location
	}
}

function Presentation(name, groups, hasText) {
	return { 
		name: name, 
		groups: groups,
		hasText: hasText
	}
}

function Group(name, color, slides) {
	return { 
		name: name, 
		color: color, 
		slides: slides 
	}
}

function Slide(text) {
	return { 
		text: text
	}
}

function StageDisplaySlide(uid, text) {
	return {
		uid: uid,
		text: text
	}
}

function ProPresenterParser() {
	function parsePlaylistAndIndex(data, currentPresentationPath) {
		const currentLocation = currentPresentationPath.split(':')[0]
		const playlist = data.playlistAll.find(p => p.playlistLocation === currentLocation)
		if (!playlist) {
			return undefined
		}
		const newItems = playlist.playlist.map(function (item) {
			const isHeader = item.playlistItemType === 'playlistItemTypeHeader'
			return PlaylistItem(item.playlistItemName, isHeader, item.playlistItemLocation)
		})
		const newPlaylist = Playlist(playlist.playlistName, newItems, playlist.playlistLocation)
		const currentIndex = newItems.findIndex(item => item.location === currentPresentationPath)
		return [newPlaylist, currentIndex]
	}
	
	function parsePresentation(data) {
		function asCSSColor(color) {
			return 'rgba(' + color.split(' ').map(c => c * 255).join(', ') + ')'
		}
		
		const presentation = data.presentation
		let presentationName = presentation.presentationName
		if (!presentationName) {
			presentationName = 'Presentation'
		}
		
		let hasText = false
		let newGroups = []
		for (const group of presentation.presentationSlideGroups) {
			let newSlides = []
			for (const slide of group.groupSlides) {
				if (!hasText && slide.slideText) {
					hasText = true
				}
				newSlides.push(Slide(slide.slideText))
			}
			
			if (presentation.presentationSlideGroups.length == 1) {
				// TODO is this correct?
				for (let i = 0; i < group.groupSlides.length; i++) {
					const slide = group.groupSlides[i]
					const name = slide.slideLabel
					const groupColor = asCSSColor(slide.slideColor)
					newGroups.push(Group(name, groupColor, [newSlides[i]]))
				}
			} else {
				const groupColor = asCSSColor(group.groupColor)
				newGroups.push(Group(group.groupName, groupColor, newSlides))
			}
		}
		return Presentation(presentationName, newGroups, hasText) 
	}
	
	function parseStageDisplayCurrentAndNext(data) {
		let current = undefined
		let next = undefined
		for (const element of data.ary) {
			switch (element.acn) {
				case 'cs':
					current = StageDisplaySlide(element.uid, element.txt)
					break
				case 'ns':
					next = StageDisplaySlide(element.uid, element.txt)
					break
				default:
					// 'csn': current stage display slide notes
					// 'nsn': next stage display slide notes
					break
			}
		}
		return [current, next]
	}
	
	return {
		parsePlaylistAndIndex: parsePlaylistAndIndex,
		parsePresentation: parsePresentation,
		parseStageDisplayCurrentAndNext: parseStageDisplayCurrentAndNext
	}
}