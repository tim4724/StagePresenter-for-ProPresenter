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

function Group(name, color, slides, containsBiblePassage) {
	return {
		name: name,
		color: color,
		slides: slides,
		containsBiblePassage: containsBiblePassage
	}
}

function Slide(lines, rawText, slideLabel, bibleVerseNumbers) {
	return {
		lines: lines,
		rawText: rawText,
		slideLabel: slideLabel,
		bibleVerseNumbers: bibleVerseNumbers
	}
}

function StageDisplaySlide(uid, text) {
	return {
		uid: uid,
		text: text
	}
}

function ProPresenterParser() {
	const optimizeBiblePresentations = true
	const onlyFirstTextInSlide = true

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

	function parseSlide(slideText, slideLabel) {
		const bibleRegex = /.+\s(\d)+:(\d)+(-(\d)+)?$/
		const slideLabelIsBiblePassage = slideLabel && bibleRegex.test(slideLabel)

		let bibleReferenceRegex
		if (slideLabelIsBiblePassage) {
			 bibleReferenceRegex = new RegExp(slideLabel + '(\\s\\(.+\\))?$')
		} else {
			// Always false...
			bibleReferenceRegex = /$.^/
		}

		function removeBibleReference(strings) {
			const notBibleReference = s => !bibleReferenceRegex.test(s)
			if (strings.length > 1 && strings.some(notBibleReference)) {
				return strings.filter(notBibleReference)
			}
			return strings
		}

		let textBoxes = slideText.split('\r')

		if (optimizeBiblePresentations) {
			let lines
			if (onlyFirstTextInSlide) {
				if (slideLabelIsBiblePassage) {
					textBoxes = removeBibleReference(textBoxes)
					lines = removeBibleReference(textBoxes[0].split('\n'))
				} else {
					lines = textBoxes[0].split('\n')
				}
			} else {
				lines = textBoxes.join('\n').split('\n')
				if (slideLabelIsBiblePassage) {
					lines = removeBibleReference(lines)
				}
			}

			const bibleVerseNumbers = []
			let lastVerseNumber = undefined
			for (let i = 0; i < lines.length; i++) {
				if (/^\d+[^\s\d]/.test(lines[i])) {
					const verseNumber = lines[i].match(/^\d+/)[0]
					lines[i] = lines[i].replace(/^\d+/, '')
					lastVerseNumber = verseNumber
					bibleVerseNumbers.push(verseNumber)
				} else {
					bibleVerseNumbers.push('')
				}
			}
			const firstVerseNumber = bibleVerseNumbers.find(v => v.length > 0)

			// Fix slidelabel to show wich verses are actually in slide
			if (slideLabelIsBiblePassage && firstVerseNumber) {
				const bookAndChapter = slideLabel.match(/.+\s(\d)+:/)[0]
				slideLabel = bookAndChapter + firstVerseNumber
				if (lastVerseNumber && lastVerseNumber > firstVerseNumber) {
					slideLabel += '-' + lastVerseNumber
				}
			}
			return Slide(lines, slideText, slideLabel, bibleVerseNumbers)
		} else {
			let text = onlyFirstTextInSlide ? textBoxes[0] : textBoxes.join('\n')
			let lines = text.split('\n')
			return Slide(lines, slideText, slideLabel)
		}
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
			const groupName = group.groupName

			let newSlides = []
			for (const slide of group.groupSlides) {
				const newSlide = parseSlide(slide.slideText, slide.slideLabel)

				if (!hasText && newSlide.lines.some(l => l.length > 0)) {
					hasText = true
				}

				if (presentation.presentationSlideGroups.length === 1) {
					const name = newSlide.slideLabel
					const groupColor = asCSSColor(slide.slideColor)
					newGroups.push(Group(
						name, groupColor, [newSlide], true))
				} else {
					newSlides.push(newSlide)
				}
			}

			if (presentation.presentationSlideGroups.length !== 1) {
				const groupColor = asCSSColor(group.groupColor)
				newGroups.push(Group(
					groupName, groupColor, newSlides, true))
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
		parseSlide: parseSlide,
		parseStageDisplayCurrentAndNext: parseStageDisplayCurrentAndNext
	}
}
