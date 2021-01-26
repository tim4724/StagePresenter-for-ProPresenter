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
	const alignLeftCharactersThreshold = parseInt(localStorage.alignLeftCharactersThreshold)
	const longLines = slides.some(s => s.lines.some(l => l.length > alignLeftCharactersThreshold))
	return {
		name: name,
		color: color,
		slides: slides,
		hasLongTextLines: longLines
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
			const name = parsePresentationName(item.playlistItemName, true)
			return PlaylistItem(name, isHeader, item.playlistItemLocation)
		})
		const newPlaylist = Playlist(playlist.playlistName, newItems, playlist.playlistLocation)
		const currentIndex = newItems.findIndex(item => item.location === currentPresentationPath)
		return [newPlaylist, currentIndex]
	}

	function parseSlide(rawText, label, color, assumeIsBiblePassage = false) {
		// Matches e.g. 'Römer 8:18' or 'Römer 8:18-23 (LU17)'
		const bibleRegex = /.+\s\d+:\d+(-\d+)?(\s\(.+\))?$/

		const isBiblePassage = assumeIsBiblePassage || 
			(label !== undefined && bibleRegex.test(label))

		let bibleReferenceRegex
		if (isBiblePassage) {
			if (label === undefined || label.length === 0) {
				bibleReferenceRegex = bibleRegex
			} else {
				let bookAndChapter = label
				// Book and chapter is always correct
				const colonIndex = bookAndChapter.indexOf(':')
				if (colonIndex > 0) {
					bookAndChapter = bookAndChapter.substr(0, colonIndex)
				}
				bibleReferenceRegex = new RegExp('^' +
					escapeRegExp(bookAndChapter) +
					':\\d+(-\\d+)?(\\s\\(.+\\))?$')
			}
		} else {
			// Always false...
			bibleReferenceRegex = /$.^/
		}

		function removeBibleReference(strings) {
			if (strings.length > 1) {
				const stringsWithoutBibleRef = strings.filter(s => !bibleReferenceRegex.test(s))
				if (label === undefined || label.length === 0) {
					label = strings.find(s => bibleReferenceRegex.test(s))
				}
				if (stringsWithoutBibleRef.length > 0) {
					return stringsWithoutBibleRef
				}
			}
			return strings
		}

		let textBoxes = rawText.split('\r')

		const features = localStorage.features.split(' ')
		const onlyFirstTextInSlide = features.includes('onlyFirstTextInSlide')
		const improveBiblePassages = features.includes('improveBiblePassages')

		// Remove a textbox that only contains the label of the slide
		if (label !== undefined && label.length > 5 && textBoxes.length > 1) {
			// We search the label in the textBoxes
			let sortedTextBoxes = textBoxes.filter(
				t => t.length > label.length + 8
				&& !t.trim().includes('\n')
				&& t.startsWith(label))
			sortedTextBoxes.sort((a, b) => a.length - b.length)
			if(sortedTextBoxes.length > 0) {
				label = sortedTextBoxes[0]
				textBoxes.splice(textBoxes.indexOf(label), 1)
			}
		}

		if (improveBiblePassages) {
			let lines
			if (onlyFirstTextInSlide) {
				if (isBiblePassage) {
					textBoxes = removeBibleReference(textBoxes)
				}
				lines = textBoxes[0].trim().split('\n')
			} else {
				lines = textBoxes.join('\n').trim().split('\n')
			}
			if (isBiblePassage) {
				lines = removeBibleReference(lines)
			}

			function fixNewLineOfBiblePassage(lines, minMatches=2) {
				// Foreach line, split line on a verse number
				// Ugly but best we can do...
				const verseRegex = /(^|\s)(\d+)[^\d\n\r].{6}/g
				let newLines = []

				for (let i = 0; i < lines.length; i++) {
					const line = lines[i]

					let matches = [...line.matchAll(verseRegex)]

					let verseNumbersAndIndices = []
					let previousVerseNumber = undefined
					for (let i = 0; i < matches.length; i++) {
						const match = matches[i]
						const verseNumber = parseInt(match[2])
						if(verseNumber > 176) {
							// 176 is the highest verse number in the bible
							continue
						}
						if (!previousVerseNumber
								|| previousVerseNumber + 1 === verseNumber
								|| previousVerseNumber === verseNumber) {
							previousVerseNumber = verseNumber
							verseNumbersAndIndices.push([verseNumber, match.index])
						}
					}

					let previousIndex = 0
					if(verseNumbersAndIndices.length >= minMatches) {
						for (let i = 0; i < verseNumbersAndIndices.length; i++) {
							const verseNumber = verseNumbersAndIndices[i][0]
							const index = verseNumbersAndIndices[i][1]
							if (index > 0) {
								newLines.push(line.substring(previousIndex, index).trim())
							}
							previousIndex = index
						}
					}
					newLines.push(line.substring(previousIndex, line.length).trim())
				}

				return newLines
			}
			lines = fixNewLineOfBiblePassage(lines)

			let bibleVerseNumbers = undefined
			let firstVerseNumber = undefined
			let lastVerseNumber = undefined

			const verseNumberRegex = /^(\d+)([^\d\n\r].*$)/
			if (lines.some(l => verseNumberRegex.test(l))) {
				bibleVerseNumbers = []
				for (let i = 0; i < lines.length; i++) {
					const match = lines[i].match(verseNumberRegex)
					if (match) {
						const verseNumber = parseInt(match[1])
						lines[i] = match[2]
						if (firstVerseNumber === undefined) {
							firstVerseNumber = verseNumber - (i > 0 ? 1 : 0)
						}
						lastVerseNumber = verseNumber
						bibleVerseNumbers.push('' + verseNumber)
					} else {
						bibleVerseNumbers.push('')
					}
				}
			}

			// Fix slidelabel to show wich verses are actually in slide
			label = fixVerseNumberOfLabel(firstVerseNumber, lastVerseNumber, label)
			return Slide(lines, rawText, label, color, isBiblePassage, bibleVerseNumbers)
		} else {
			let text = onlyFirstTextInSlide ? textBoxes[0] : textBoxes.join('\n')
			let lines = text.trim().split('\n')
			for (let i = 0; i < lines.length; i++) {
				lines[i] = lines[i].trim()
			}
			return Slide(lines, rawText, label, color, isBiblePassage, undefined)
		}
	}

	function fixVerseNumberOfLabel(firstVerseNumber, lastVerseNumber, label) {
		if (firstVerseNumber && /.+\s\d+:/.test(label)) {
			const parts = label.match(/.+\s\d+:\d+(-\d+)?(\s\(.+\))$/)
			const translation = parts ? parts[2] : undefined

			const bookAndChapter = label.match(/.+\s\d+:/)[0]
			label = bookAndChapter + firstVerseNumber
			if (lastVerseNumber && lastVerseNumber > firstVerseNumber) {
				label += '-' + lastVerseNumber
			}
			if(translation) {
				label += ' ' + translation.trim()
			}
		}
		return label
	}

	function parsePresentation(data) {
		function asCSSColor(color) {
			return 'rgba(' + color.split(' ').map(c => c * 255).join(', ') + ')'
		}

		const presentation = data.presentation

		// Matches e.g. 'Römer 8_18' or 'Römer 8_18-23 (LU17)'
		const bibleRegex = /^.+\s\d+_\d+(-\d+)?(\s\(.+\))?$/
		const isBiblePresentation = bibleRegex.test(presentation.presentationName)

		const presentationName = parsePresentationName(presentation.presentationName)

		let newGroups = []
		for (const group of presentation.presentationSlideGroups) {
			let groupName = parseGroupName(group.groupName || '')

			// Matches e.g. 'Römer 8:18' or 'Römer 8:18-23 (LU17)'
			let bibleRegex_colon = /^.+\s\d+:\d+(-\d+)?(\s\(.+\))?$/
			const isBibleGroup = bibleRegex_colon.test(groupName)

			const splitSlidesInGroups = presentation.presentationSlideGroups.length === 1
				&& group.groupSlides.length > 1
				&& groupName.length === 0

			let newSlides = []
			for (const slide of group.groupSlides) {
				const newSlide = parseSlide(
					slide.slideText,
					slide.slideLabel,
					asCSSColor(slide.slideColor),
					isBiblePresentation || isBibleGroup
				)

				if (splitSlidesInGroups) {
					const name = newSlide.label
					const groupColor = newSlide.color
					newGroups.push(Group(
						parseGroupName(name), groupColor, [newSlide]))
				} else {
					newSlides.push(newSlide)
				}
			}

			if (!splitSlidesInGroups) {
				const groupColor = asCSSColor(group.groupColor)
				if(isBibleGroup
					&& newSlides.length > 0
					&& newSlides[0].bibleVerseNumbers) {
					const firstSlide = newSlides[0]

					let firstVerseNumber = firstSlide.bibleVerseNumbers[0]
					if (!firstVerseNumber && firstSlide.bibleVerseNumbers[1]) {
						firstVerseNumber = parseInt(firstSlide.bibleVerseNumbers[1]) - 1
					}

					if (firstVerseNumber && !isNaN(firstVerseNumber)) {
						const lastSlide = newSlides[newSlides.length - 1]
						let lastVerseNumber = undefined
						if (lastSlide && lastSlide.bibleVerseNumbers) {
							const lastIndex = lastSlide.bibleVerseNumbers.length - 1
							lastVerseNumber = lastSlide.bibleVerseNumbers[lastIndex]
						}
	                    groupName = fixVerseNumberOfLabel(firstVerseNumber, lastVerseNumber, groupName)
					}
				}
				newGroups.push(Group(groupName, groupColor, newSlides))
			}
		}

		return Presentation(presentationName, newGroups)
	}

	function parsePresentationName(presentationName, shorterBibleName) {
		if (!presentationName) {
			return 'Presentation'
		}
		presentationName = presentationName.trim().normalize()

		// Matches e.g. 'Römer 8:18' or 'Römer 8:18-23 (LU17)'
		const biblePresentationNameRegex = /^((\d+).?\s?)?(.+)\s(\d+)_(\d+(-\d+)?(\s\(.+\))?)$/

		const match = presentationName.match(biblePresentationNameRegex)
		if (match) {
			// Römer 8_12-15 -> Römer 8:12-15
			let bookName = ''
			if (match[2]) {
				bookName = match[2] + '. '
			}
			if(shorterBibleName) {
				// Römer 8_12-15 -> Röm 8:12-15
				bookName += match[3].substring(0, 3)
			} else {
				bookName += match[3]
			}
			return bookName + ' ' + match[4] + ':' + match[5]
		}
		return presentationName
	}

	function parseGroupName(groupName) {
		if(groupName === undefined) {
			return ''
		}
		groupName = (groupName || '').trim().normalize()
		const bibleGroupNameRegex = /^((\d+).?\s?)?(.+)\s(\d+):(\d+(-\d+)?(\s\(.+\))?)$/u
		const match = groupName.match(bibleGroupNameRegex)
		if (match) {
			// 1 John 1:1 -> 1. John 1:1
			let bookName = ''
			if (match[2]) {
				bookName = match[2] + '. '
			}
			bookName += match[3]
			return bookName + ' ' + match[4] + ':' + match[5]
		}
		return groupName
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
		parseGroupName: parseGroupName,
		parseStageDisplayCurrentAndNext: parseStageDisplayCurrentAndNext
	}
}
