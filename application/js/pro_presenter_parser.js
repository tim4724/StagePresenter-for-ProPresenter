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

function Presentation(name, groups) {
	return {
		name: name,
		groups: groups,
		hasText: () => groups.some(g => g.slides.some(s => s.lines.some(l => l.length > 0)))
	}
}

function Group(name, color, slides) {
	return {
		name: name,
		color: color,
		slides: slides
	}
}

function Slide(lines, rawText, label, color, isBiblePassage, bibleVerseNumbers) {
	return {
		lines: lines,
		rawText: rawText,
		label: label,
		color: color,
		isBiblePassage: isBiblePassage,
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
	const onlyFirstTextInSlide = true

	function parsePlaylistAndIndex(data, currentPresentationPath) {
		let playlist = undefined
		if (data.playlistAll.length === 1) {
			playlist = data.playlistAll[0]
		} else if (currentPresentationPath) {
			const currentLocation = currentPresentationPath.split(':')[0]
			playlist = data.playlistAll.find(p => p.playlistLocation === currentLocation)
		}
		if (!playlist) {
			return [undefined, -1]
		}
		const newItems = playlist.playlist.map(function (item) {
			const isHeader = item.playlistItemType === 'playlistItemTypeHeader'
			return PlaylistItem(item.playlistItemName, isHeader, item.playlistItemLocation)
		})
		const newPlaylist = Playlist(playlist.playlistName, newItems, playlist.playlistLocation)
		const currentIndex = newItems.findIndex(item => item.location === currentPresentationPath)
		return [newPlaylist, currentIndex]
	}

	function parseSlide(text, label, color, assumeIsBiblePassage = false) {
		// Matches e.g. 'Römer 8:18' or 'Römer 8:18-23 (LU17)'
		const bibleRegex = /.+\s(\d)+:(\d)+(-(\d)+)?(\s\(.+\))?$/

		const isBiblePassage = assumeIsBiblePassage || 
			(label !== undefined && bibleRegex.test(label))

		let bibleReferenceRegex
		if (isBiblePassage) {
			if (label === undefined) {
				bibleReferenceRegex = bibleRegex
			} else {
				// Matches e.g. '<label>' or '<label> (LU17)'
				bibleReferenceRegex = new RegExp(escapeRegExp(label) + '(\\s\\(.+\\))?$')
			}
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

		let textBoxes = text.split('\r')

		if (localStorage.improveBiblePassages !== 'false') {
			let lines
			if (onlyFirstTextInSlide) {
				if (isBiblePassage) {
					textBoxes = removeBibleReference(textBoxes)
					lines = removeBibleReference(textBoxes[0].trim().split('\n'))
				} else {
					lines = textBoxes[0].trim().split('\n')
				}
			} else {
				lines = textBoxes.join('\n').trim().split('\n')
				if (isBiblePassage) {
					lines = removeBibleReference(lines)
				}
			}

			function fixNewLineOfBiblePassage(lines) {
				// Foreach line, split line on a verse number
				// Ugly but best we can do...
				const verseNumberRegex = /\d+\w/g
				let newLines = []

				for (let i = 0; i < lines.length; i++) {
					const line = lines[i]
					let matches = [...line.matchAll(verseNumberRegex)]

					let previousVerseNumber = undefined
					let previousIndex = 0

					for (let i = 0; i < matches.length; i++) {
						const match = matches[i]
						const verseNumber = parseInt(match[0].substr(0, match[0].length -1))
						const index = match.index
						if (!previousVerseNumber ||
								previousVerseNumber + 1 === verseNumber ||
								previousVerseNumber === verseNumber) {
							if (index !== 0) {
								newLines.push(line.substring(previousIndex, index))
							}
							previousIndex = index
							previousVerseNumber = verseNumber
						}
					}
					newLines.push(line.substring(previousIndex, line.length))
				}

				return newLines
			}
			lines = fixNewLineOfBiblePassage(lines)

			let bibleVerseNumbers = undefined
			let firstVerseNumber = undefined
			let lastVerseNumber = undefined

			const verseNumberRegex = /^\d+\w/
			if (lines.some(l => verseNumberRegex.test(l))) {
				bibleVerseNumbers = []
				for (let i = 0; i < lines.length; i++) {
					if (verseNumberRegex.test(lines[i])) {
						const verseNumber = lines[i].match(/^\d+/)[0]
						lines[i] = lines[i].replace(/^\d+/, '')
						if (firstVerseNumber === undefined) {
							firstVerseNumber = verseNumber
						}
						lastVerseNumber = verseNumber
						bibleVerseNumbers.push(verseNumber)
					} else {
						bibleVerseNumbers.push('')
					}
				}
			}

			// Fix slidelabel to show wich verses are actually in slide
			if (firstVerseNumber && /.+\s(\d)+:/.test(label)) {
				const parts = label.match(/.+\s(\d)+:(\d)+(-(\d)+)?(\s\(.+\))$/)
				const translation = parts ? parts[5] : undefined

				const bookAndChapter = label.match(/.+\s(\d)+:/)[0]
				label = bookAndChapter + firstVerseNumber
				if (lastVerseNumber && lastVerseNumber != firstVerseNumber) {
					label += '-' + lastVerseNumber
				}
				if(translation) {
					label += ' ' + translation.trim()
				}
			}
			return Slide(lines, text, label, color, isBiblePassage, bibleVerseNumbers)
		} else {
			let text = onlyFirstTextInSlide ? textBoxes[0] : textBoxes.join('\n')
			let lines = text.trim().split('\n')
			return Slide(lines, text, label, color, isBiblePassage, undefined)
		}
	}

	function parsePresentation(data) {
		function asCSSColor(color) {
			return 'rgba(' + color.split(' ').map(c => c * 255).join(', ') + ')'
		}

		const presentation = data.presentation
		let presentationName = presentation.presentationName
		// TODO: Shorten presentation name of bible presentations
		if (!presentationName) {
			presentationName = 'Presentation'
		}

		let newGroups = []
		for (const group of presentation.presentationSlideGroups) {
			const groupName = group.groupName

			let newSlides = []
			for (const slide of group.groupSlides) {
				const newSlide = parseSlide(
					slide.slideText,
					slide.slideLabel,
					asCSSColor(slide.slideColor)
				)

				if (presentation.presentationSlideGroups.length === 1) {
					const name = newSlide.label
					const groupColor = newSlide.color
					newGroups.push(Group(
						name, groupColor, [newSlide]))
				} else {
					newSlides.push(newSlide)
				}
			}

			if (presentation.presentationSlideGroups.length !== 1) {
				const groupColor = asCSSColor(group.groupColor)
				newGroups.push(Group(
					groupName, groupColor, newSlides))
			}
		}
		return Presentation(presentationName, newGroups)
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
