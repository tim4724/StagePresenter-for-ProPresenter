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

function PreviewDomUpdater() {
	const previewElement = document.getElementById('preview')
	const largePreviewElement = document.getElementById('largePreview')
	const tiffDecoderWorker = new Worker('js/tiff_decoder_worker.js')
	const cache = Cache()

	function getPreviewUrl(slideUid) {
		return 'http://' + getHost() + '/stage/image/' + slideUid
	}
	let currentUrl = undefined
	let nextUrl = undefined

	tiffDecoderWorker.onmessage = function(e) {
		const { url, blob } = e.data
		console.log('image size', blob.size)
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
					previewElement.src = nextObjectUrl || ''
					previewElement.style.opacity = 1
				} else {
					// next is still loading
					previewElement.style.opacity = 0
				}
			} else {
				previewElement.src = currentObjectUrl
				previewElement.style.opacity = 1
			}
		} else {
			// Still loading...
			previewElement.style.opacity = 0.5
			largePreviewElement.style.opacity = 0.5
		}
	}

	function changeSlide(uid, nextSlideUid) {
		currentUrl = getPreviewUrl(uid)
		nextUrl = getPreviewUrl(nextSlideUid)

		showCurrentAndNext()

		// Do not load if uid is 000...000
		if (uid && uid !== '00000000-0000-0000-0000-000000000000') {
			// Always load preview image, because the slide could have been edited
			tiffDecoderWorker.postMessage(currentUrl)
		}
		// Do not load if uid is 000...000
		if (nextSlideUid && nextSlideUid !== '00000000-0000-0000-0000-000000000000') {
			// Always load preview image, because the slide could have been edited
			tiffDecoderWorker.postMessage(nextUrl)
		}
	}

	function showLargePreview() {
		if (largePreviewElement.style.display !== 'block') {
			largePreviewElement.style.display = 'block'
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

	return {
		changeSlide: changeSlide,
		showLargePreview: showLargePreview,
		hideLargePreview: hideLargePreview
	}
}
