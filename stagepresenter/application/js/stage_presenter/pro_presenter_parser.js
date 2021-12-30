"use strict"

// Matches e.g. 'Römer 8_18' or 'Römer 8_18-23 (LU17)'
// Also matches 'John 3_16-17 (KJV)-1' or John 3_16-1
const biblePresentationNameRegex =
	/^((\d+).?\s?)?(.+)\s(\d+)_(\d+(-(\d+))?)((\s\(.+\))(-\d+)?)?$/

function Playlist(name, items, location) {
	return {
		name: name,
		items: items,
		location: location
	}
}

function PlaylistItem(text, type, location) {
	return {
		text: text,
		type: type,
		location: location
	}
}

function Presentation(name, groups) {
	return {
		name: name,
		groups: groups,
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

function Slide(
	rawText,
	previewImage,
	lines,
	label,
	color,
	slideNotes,
	isBiblePassage,
	lineNumbers,
	enabled=true,
	forceKeepLinebreaks=false,
	showImageFullscreen=false,
	showImageLarger=false,
	lineHasMusicInfo=[]
) {
	return {
		rawText: rawText,
		previewImage: previewImage,
		lines: lines,
		label: label,
		color: color,
		isBiblePassage: isBiblePassage,
		lineNumbers: lineNumbers,
		enabled: enabled,
		forceKeepLinebreaks: forceKeepLinebreaks,
		showImageFullscreen: showImageFullscreen,
		showImageLarger: showImageLarger,
		slideNotes: slideNotes,
		lineHasMusicInfo: lineHasMusicInfo
	}
}

function StageDisplaySlide(uid, text) {
	return {
		uid: uid,
		text: text
	}
}

function ProPresenterParser() {
	function parsePlaylists(data) {
		let newPlaylists = []
		for (const playlist of data.playlistAll) {
			if (playlist.playlistType == "playlistTypeGroup") {
				const playlistsInGroup = {playlistAll: playlist.playlist}
				newPlaylists = newPlaylists.concat(parsePlaylists(playlistsInGroup))
			} else {
				const newItems = playlist.playlist.map(function (item) {
					const name = parsePresentationName(item.playlistItemName, true)
					return PlaylistItem(name, item.playlistItemType, item.playlistItemLocation)
				})
				const newPlaylist = Playlist(playlist.playlistName, newItems, playlist.playlistLocation)
				newPlaylists.push(newPlaylist)
			}
		}
		return newPlaylists
	}

	function parseSlide(rawText,
						label,
						color,
						previewImage = undefined,
						assumeIsBiblePassage = false,
						enabled = true,
						slideNotes = "",
						playlistItemType = undefined) {
		let keepLinebreaks = false
		const features = localStorage.features.split(' ')
		const slideNotesReplaceSlideContent = features.includes("slideNotesReplaceSlideContent") && slideNotes.length > 0
		if (slideNotesReplaceSlideContent) {
			rawText = slideNotes
			slideNotes = ""
			keepLinebreaks = true
		} else if (!features.includes("showSlideNotes")) {
			slideNotes = ""
		}

		if (playlistItemType == "playlistItemTypeAudio" && !previewImage) {
			previewImage = "img/play_banner.png"
		}

		if (label && (/\$stagepresenter:keepLinebreaks/i).test(label)) {
			label = label.replace(/\$stagepresenter:keepLinebreaks/i, "")
			keepLinebreaks = true
		}
		if (label && (/\$stagepresenter:showImageFullscreen/i).test(label)) {
			label = label.replace(/\$stagepresenter:showImageFullscreen/i, "")
			return Slide("", previewImage, [], label, color, slideNotes, false, undefined, enabled, false, true, false)
		}
		if (label && (/\$stagepresenter:showImageLarger/i).test(label)) {
			label = label.replace(/\$stagepresenter:showImageLarger/i, "")
			return Slide("", previewImage, [], label, color, slideNotes, false, undefined, enabled, false, false, true)
		}
		if (label && (/\$stagepresenter:showImage/i).test(label)) {
			label = label.replace(/\$stagepresenter:showImage/i, "")
			return Slide("", previewImage, [], label, color, slideNotes, false, undefined, enabled, false, false, false)
		}

		// Matches e.g. 'Römer 8:18' or 'Römer 8:18-23 (LU17)'
		const bibleRegex = /.+\s\d+:\d+(-\d+)?(\s\(.+\))?$/

		const isBiblePassage = assumeIsBiblePassage || (label && bibleRegex.test(label))

		let bibleReferenceRegex
		if (isBiblePassage) {
			if (!label) {
				bibleReferenceRegex = bibleRegex
			} else {
				let bookAndChapter = label
				// Book and chapter is always correct
				const colonIndex = bookAndChapter.indexOf(':')
				if (colonIndex > 0) {
					bookAndChapter = bookAndChapter.substr(0, colonIndex)
				}
				bibleReferenceRegex = new RegExp('^' + escapeRegExp(bookAndChapter) + ':\\d+(-\\d+)?(\\s\\(.+\\))?$')
			}
		} else {
			// Always false...
			bibleReferenceRegex = /$.^/
		}

		function removeEmptyLines(lines) {
			return lines.filter(line => line.trim().length > 0)
		}

		function trimEndOfLine(line) {
			return line.replace(/\s*$/, '')
		}

		function removeBibleReference(strings) {
			if (strings.length > 1) {
				const stringsWithoutBibleRef = strings.filter(s => !bibleReferenceRegex.test(s))
				if (!label) {
					label = strings.find(s => bibleReferenceRegex.test(s))
				}
				if (stringsWithoutBibleRef.length > 0) {
					return stringsWithoutBibleRef
				}
			}
			return strings
		}

		function getLineHasMusicInfo(lines) {
			const musicalCharacters = [
				"c", "d", "e", "f", "g", "a", "b", "h",
				"C", "D", "E", "F", "G", "A", "B", "H",
				"♭", "𝄫", "#", "♯", "♮", "m", "𝄞", "𝄢",
				"1", "2", "3", "4", "5", "6", "7", "8", "9", "x",
				"𝄀", "𝄁", "𝄂", "𝄃", "𝄄", "𝄅", "𝄆", "𝄇", "𝄈",
				" ", "-", "_", ",", ".", ":", "/", "|", "(", ")", "{", "}", "?", "$"
			]
			let lineHasMusicInfo = []
			for (let line of lines) {
				const tmp = line.replace("sus", "x").replace("rif", "x")
				lineHasMusicInfo.push(
					line.split(' ').length / tmp.length >= 0.25 &&
					line.split('').every(c => musicalCharacters.includes(c))
				)
			}
			return lineHasMusicInfo
		}

		let textBoxes = []
		if (rawText.length > 0) {
			textBoxes = rawText.split('\r')
		}
		const onlyFirstTextInSlide = features.includes('onlyFirstTextInSlide')
		const improveBiblePassages = features.includes('improveBiblePassages')

		// Remove a textbox that only contains the label of the slide
		if (label && label.length > 5 && textBoxes.length > 1) {
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

		if (improveBiblePassages && textBoxes.length > 0) {
			let lines
			if (onlyFirstTextInSlide) {
				if (isBiblePassage) {
					textBoxes = removeBibleReference(textBoxes)
				}
				lines = textBoxes[0].split('\n')
			} else {
				lines = textBoxes.join('\n').split('\n')
			}
			lines = removeEmptyLines(lines)
			if (isBiblePassage) {
				lines = removeBibleReference(lines)
			}

			function fixNewLineOfBiblePassage(lines, minMatches=2) {
				// Foreach line, split line on a verse number
				// Ugly but best we can do...
				const verseRegex = /(^|\s)(\d+)(\w|\s)[^\d\n\r].{6}/g
				let newLines = []

				for (let i = 0; i < lines.length; i++) {
					const line = lines[i]

					let previousIndex = 0

					if (!bibleReferenceRegex.test(line)) {
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

						if(verseNumbersAndIndices.length >= minMatches) {
							for (let i = 0; i < verseNumbersAndIndices.length; i++) {
								const verseNumber = verseNumbersAndIndices[i][0]
								const index = verseNumbersAndIndices[i][1]
								if (index > 0) {
									newLines.push(
										trimEndOfLine(line.substring(previousIndex, index))
									)
								}
								previousIndex = index
							}
						}
					}

					newLines.push(
						trimEndOfLine(line.substring(previousIndex, line.length))
					)
				}

				return newLines
			}
			lines = fixNewLineOfBiblePassage(lines)
			lines = removeEmptyLines(lines)

			let lineNumbers = undefined
			let firstVerseNumber = undefined
			let lastVerseNumber = undefined

			const verseNumberRegex = /^(\d+)([^\d\n\r].*$)/
			if (lines.some(l => verseNumberRegex.test(l))) {
				lineNumbers = []
				for (let i = 0; i < lines.length; i++) {
					if (bibleReferenceRegex.test(lines[i])) {
						lineNumbers.push('')
						continue
					}
					const match = lines[i].match(verseNumberRegex)
					if (match) {
						const verseNumber = parseInt(match[1])
						lines[i] = match[2]
						if (!firstVerseNumber) {
							firstVerseNumber = verseNumber - (i > 0 ? 1 : 0)
						}
						lastVerseNumber = verseNumber
						lineNumbers.push('' + verseNumber)
					} else {
						lineNumbers.push('')
					}
				}
			}

			// Fix slidelabel to show wich verses are actually in slide
			label = fixVerseNumberOfLabel(firstVerseNumber, lastVerseNumber, label)
			let lineHasMusicInfo = []
			if (slideNotesReplaceSlideContent) {
				lineHasMusicInfo = getLineHasMusicInfo(lines)
			}
			return Slide(rawText, previewImage, lines, label, color, slideNotes, isBiblePassage, lineNumbers, enabled, keepLinebreaks, false, false, lineHasMusicInfo)
		} else {
			let lines = []
			if (textBoxes.length > 0) {
				const text = onlyFirstTextInSlide ? textBoxes[0] : textBoxes.join('\n')
				lines = text.split('\n')
				for (let i = 0; i < lines.length; i++) {
					lines[i] = trimEndOfLine(lines[i])
				}
			}
			lines = removeEmptyLines(lines)
			let lineHasMusicInfo = []
			if (slideNotesReplaceSlideContent) {
				lineHasMusicInfo = getLineHasMusicInfo(lines)
			}
			return Slide(rawText, previewImage, lines, label, color, slideNotes, isBiblePassage, undefined, enabled, keepLinebreaks, false, false, lineHasMusicInfo)
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
			if (!color || color.length === 0) {
				return ''
			} else {
				return 'rgba(' + color.split(' ').map(c => c * 255).join(', ') + ')'
			}
		}

		const presentation = data.presentation

		// Matches e.g. 'Römer 8_18' or 'Römer 8_18-23 (LU17)'
		// Also atches e.g. 'Römer 8_18-23 (LU17)-1'
		const isBiblePresentation = biblePresentationNameRegex
			.test(presentation.presentationName)

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
				const slideText = slide.slideText
				const slideNotes = slide.slideNotes
				const playlistItemType = slide.playlistItemType

				const newSlide = parseSlide(
					slideText,
					slide.slideLabel,
					asCSSColor(slide.slideColor),
					slide.slideImage,
					isBiblePresentation || isBibleGroup,
					slide.slideEnabled,
					slideNotes,
					playlistItemType
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
					&& newSlides[0].lineNumbers) {
					const firstSlide = newSlides[0]

					let firstVerseNumber = firstSlide.lineNumbers[0]
					if (!firstVerseNumber && firstSlide.lineNumbers[1]) {
						firstVerseNumber = parseInt(firstSlide.lineNumbers[1]) - 1
					}

					if (firstVerseNumber && !isNaN(firstVerseNumber)) {
						const lastSlide = newSlides[newSlides.length - 1]
						let lastVerseNumber = undefined
						if (lastSlide && lastSlide.lineNumbers) {
							const lastIndex = lastSlide.lineNumbers.length - 1
							lastVerseNumber = lastSlide.lineNumbers[lastIndex]
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
			const chapter = match[4]
			let verse = parseInt(match[5])
			const verseTo = parseInt(match[7])
			if (Number.isInteger(verseTo) && verseTo > 1 && verse < verseTo) {
				verse = "" + verse + "-" + verseTo
			}
			const translation = match[9] || ""
			return bookName + ' ' + chapter + ':' + verse + translation
		}
		return presentationName
	}

	function parseGroupName(groupName) {
		if(!groupName) {
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
		parsePlaylists: parsePlaylists,
		parsePresentation: parsePresentation,
		parseSlide: parseSlide,
		parseGroupName: parseGroupName,
		parseStageDisplayCurrentAndNext: parseStageDisplayCurrentAndNext
	}
}
