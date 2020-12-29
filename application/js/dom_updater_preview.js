"use strict"

function Cache(maxItems = 24) {
	const keys = []
	const map = new Map()

	function add(id, objectUrl) {
		if (map.has(id)) {
			URL.revokeObjectURL(map.get(id))
		} else {
			keys.push(id)
		}
		map.set(id, objectUrl)

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

	tiffDecoderWorker.onmessage = function(e) {
		const { url, objectURL } = e.data
		if (objectURL) {
			cache.add(url, objectURL)
		}
		if (url === currentUrl) {
			show(objectURL ? objectURL : '')
		}
	}

	function show(objectUrl) {
		previewElement.src = objectUrl
		previewElement.style.opacity = 1
		if (largePreviewElement.style.display !== 'none') {
			largePreviewElement.src = objectUrl
			largePreviewElement.style.opacity = 1
		}
	}

	function changeSlide(uid, nextSlideUid) {
		currentUrl = getPreviewUrl(uid)

		const currentObjectUrl = cache.get(currentUrl)

		// Do not load if uid is 000...000
		if (uid && uid !== '00000000-0000-0000-0000-000000000000') {
			// Always load preview image, because the slide could have been edited
			tiffDecoderWorker.postMessage(currentUrl)
		}

		if (currentObjectUrl) {
			// TODO: bug if text of cached slide is edited...
			show(currentObjectUrl)
		} else {
			// Set img opacity while loading new image
			previewElement.style.opacity = 0.5
			largePreviewElement.style.opacity = 0.5
		}

		if (nextSlideUid && nextSlideUid !== '00000000-0000-0000-0000-000000000000') {
			// Always load preview image, because the slide could have been edited
			tiffDecoderWorker.postMessage(getPreviewUrl(nextSlideUid))
		}
	}

	function showLargePreview() {
		if (largePreviewElement.style.display !== 'block') {
			largePreviewElement.src = previewElement.src
			largePreviewElement.style.display = 'block'
		}
	}

	function hideLargePreview() {
		largePreviewElement.src = ''
		largePreviewElement.style.display = 'none'
	}

	return {
		changeSlide: changeSlide,
		showLargePreview: showLargePreview,
		hideLargePreview: hideLargePreview
	}
}
