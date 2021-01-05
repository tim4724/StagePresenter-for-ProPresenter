"use strict"

function Cache(maxItems = 16) {
	let keys = []
	const map = new Map()

	function add(id, objectUrl) {
		// Remove if old entry with that id exists
		keys = keys.filter(k => k !== id)
		if (map.has(id)) {
			URL.revokeObjectURL(map.get(id))
		}

		// Add new id, object Url
		keys.push(id)
		map.set(id, objectUrl)

		// Remove old items
		if (keys.length > maxItems) {
			const victimId = keys.shift()
			URL.revokeObjectURL(map.get(victimId))
			map.delete(victimId)
		}
	}

	return {
		add: add,
		get: map.get.bind(map),
		has: map.has.bind(map)
	}
}

function renderPreviewImage(text, width, height) {
	const canvas = new OffscreenCanvas(width, height)
	const context = canvas.getContext('2d')

	context.rect(0, 0, width, height)
	context.fillStyle = "#111111"
	context.fill()
	if (text && text.length > 0) {
		if (text.length > 26) {
			text = text.substr(0, 24) + '...'
		}
		const fontArgs = context.font.split(' ')

		context.fillStyle = "#ffffff"
		context.textAlign = "center"
		context.font = width / 8 + 'px ' + fontArgs[1]
		context.fillText('Media', width / 2, height / 3)

		context.fillStyle = "#69c0ff"
		context.textAlign = "center"
		context.font = width / 14 + 'px ' + fontArgs[1]
		context.fillText(text, width / 2, height * 2 / 3)
	}

	return canvas.convertToBlob({ type: "image/jpeg", quality: 0.9 })
}

function PreviewDomUpdater() {
	const previewElement = document.getElementById('preview')
	const largePreviewElement = document.getElementById('largePreview')
	const tiffDecoderWorker = new Worker('js/tiff_decoder_worker.js')
	const cache = Cache()
	let currentUrlNotLoaded = false

	function getPreviewUrl(slideUid) {
		return 'http://' + getHost() + '/stage/image/' + slideUid
	}
	let currentUrl = undefined
	let nextUrl = undefined

	tiffDecoderWorker.onmessage = (ev) => {
		const { url, blob } = ev.data
		onBlobLoaded(url, blob)
	}

	function onBlobLoaded(url, blob) {
		const objectURL = URL.createObjectURL(blob)
		cache.add(url, objectURL || '')
		if (url === currentUrl || url === nextUrl) {
			showCurrentAndNext()
		}
	}

	function showCurrentAndNext() {
		const currentObjectUrl = cache.get(currentUrl)
		const nextObjectUrl = cache.get(nextUrl)

		if (currentObjectUrl) {
			if (largePreviewElement.style.display !== 'none') {
				largePreviewElement.src = currentObjectUrl
				largePreviewElement.style.opacity = 1

				if (nextObjectUrl) {
					previewElement.src = nextObjectUrl
					previewElement.style.opacity = 1
				} else {
					// next is still loading
					previewElement.src = cache.get('')
				}
			} else {
				previewElement.src = currentObjectUrl
				previewElement.style.opacity = 1
			}
		} else {
			// Still loading...
			previewElement.src = cache.get('')
			// previewElement.style.opacity = 0
			largePreviewElement.style.opacity = 0
		}
	}

	function changePreview(slideUid, nextSlideUid) {
		currentUrl = getPreviewUrl(slideUid)
		nextUrl = getPreviewUrl(nextSlideUid)

		showCurrentAndNext()

		const previewVisible = previewElement.offsetParent !== null
			|| largePreviewElement.offsetParent !== null

		// Do not load if uid is 000...000
		if (slideUid && slideUid !== '00000000-0000-0000-0000-000000000000') {
			if(previewVisible) {
				// Always load preview image, because the slide could have been edited
				tiffDecoderWorker.postMessage(currentUrl)
			} else {
				currentUrlNotLoaded = true
			}
		}
		// Do not load if uid is 000...000
		if (previewVisible &&
				nextSlideUid && nextSlideUid !== '00000000-0000-0000-0000-000000000000') {
			// Always load preview image, because the slide could have been edited
			tiffDecoderWorker.postMessage(nextUrl)
		}
	}

	function clearPreview(text) {
		currentUrl = text
		nextUrl = ''
		if (cache.get(currentUrl)) {
			showCurrentAndNext()
		} else {
			// TODO: ratio from preview width/heigt
			const width = 1920
			const height = 1080
			renderPreviewImage(text, width, height).then((blob) => {
				onBlobLoaded(text, blob)
			})
		}
	}

	function showLargePreview() {
		if (largePreviewElement.style.display !== 'block') {
			largePreviewElement.style.display = 'block'
			if (currentUrlNotLoaded) {
				tiffDecoderWorker.postMessage(currentUrl)
				tiffDecoderWorker.postMessage(nextUrl)
				currentUrlNotLoaded = true
			}
			showCurrentAndNext()
		}
	}

	function hideLargePreview() {
		if (largePreviewElement.style.display !== 'none') {
			largePreviewElement.src = ''
			largePreviewElement.style.display = 'none'
			showCurrentAndNext()
		}
	}
	clearPreview('')

	return {
		changePreview: changePreview,
		clearPreview: clearPreview,
		showLargePreview: showLargePreview,
		hideLargePreview: hideLargePreview
	}
}
