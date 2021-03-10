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
		if (text.length > 22) {
			text = text.substr(0, 20) + '...'
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

	let width = 1920
	let height = 1080
	let placeholderImageURL = 'black16x9.png'
	function renderPlaceholderImage() {
		renderPreviewImage('', width, height).then((blob) => {
			URL.revokeObjectURL(placeholderImageURL)
			placeholderImageURL = URL.createObjectURL(blob)
		})
	}
	renderPlaceholderImage()

	tiffDecoderWorker.onmessage = (ev) => {
		const { url, objectURL, w, h } = ev.data
		onObjectURLLoaded(url, objectURL)

		if (w > 0 && h > 0 && (w !== width || h !== height)) {
			width = w
			height = h
			renderPlaceholderImage()
		}
	}

	function onObjectURLLoaded(url, objectURL) {
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

				if (nextObjectUrl) {
					previewElement.src = nextObjectUrl
				} else {
					// next is still loading
					previewElement.src = placeholderImageURL
				}
			} else {
				previewElement.src = currentObjectUrl
			}
		} else {
			// Still loading...
			previewElement.src = placeholderImageURL
			largePreviewElement.src = placeholderImageURL
		}
	}

	function changePreview(slideUid, nextSlideUid) {
		showCurrentAndNext()

		const previewVisible = previewElement.offsetParent !== null
			|| largePreviewElement.offsetParent !== null

		// Do not load if uid is 000...000
		if (slideUid && slideUid !== '00000000-0000-0000-0000-000000000000') {
			currentUrl = getPreviewUrl(slideUid)
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
			nextUrl = getPreviewUrl(nextSlideUid)
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
			renderPreviewImage(text, width, height).then((blob) => {
				onObjectURLLoaded(text, URL.createObjectURL(blob))
			})
		}
	}

	function showLargePreview() {
		if (largePreviewElement.style.display !== 'block') {
			largePreviewElement.style.display = 'block'
			if (currentUrlNotLoaded) {
				tiffDecoderWorker.postMessage(currentUrl)
				tiffDecoderWorker.postMessage(nextUrl)
				currentUrlNotLoaded = false
			}
			showCurrentAndNext()
		}
	}

	function hideLargePreview() {
		if (largePreviewElement.style.display !== 'none') {
			largePreviewElement.style.display = 'none'
			largePreviewElement.src = ''
			showCurrentAndNext()
		}
	}

	return {
		changePreview: changePreview,
		clearPreview: clearPreview,
		showLargePreview: showLargePreview,
		hideLargePreview: hideLargePreview
	}
}
