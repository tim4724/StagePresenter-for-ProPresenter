"use strict"

const maxCacheItems = 24

function PreviewDomUpdater(host) {
	const baseUrl = 'http://' + host + '/stage/image/'
	const previewElement = document.getElementById('preview')
	const largePreviewElement = document.getElementById('largePreview')
	const tiffDecoderWorker = new Worker('js/tiff_decoder_worker.js');

	let previewImageCache = undefined
	caches.open('previewImageCache').then(cache => {
		previewImageCache = cache
	})
	let currentUrl = undefined

	tiffDecoderWorker.onmessage = function(e) {
		const { url, dataURL, isCurrent } = e.data
		if (dataURL) {
			previewImageCache.put(url, new Response(dataURL))
		}
		if (url === currentUrl) {
			show(dataURL ? dataURL : '')
		}
	}
	
	function show(dataUrl) {
		previewElement.src = dataUrl
		previewElement.style.opacity = 1
		if (largePreviewElement.style.display !== 'none') {
			largePreviewElement.src = dataUrl
			largePreviewElement.style.opacity = 1
		}
	}
	
	function changeSlide(uid, nextSlideUid) {
		currentUrl = baseUrl + uid
		previewImageCache.match(currentUrl).then(response => {
			if (response !== undefined) {
				response.text().then(show)
			} else {
				// Make transparent, we need to load the image from the network
				previewElement.style.opacity = 0.5
				if (largePreviewElement.style.display !== 'none') {
					largePreviewElement.style.opacity = 0.5
				}
				tiffDecoderWorker.postMessage(currentUrl)
			}
		})
			
		previewImageCache.keys().then(function(requests) {
			if (nextSlideUid && nextSlideUid !== '00000000-0000-0000-0000-000000000000') {
				const nextUrl = baseUrl + nextSlideUid
				if (!requests.some(request => request.url === nextUrl)) {
					// Load the next slides image
					tiffDecoderWorker.postMessage(nextUrl)
				}
			}
			
			// Delete old cache entries
			for (let i = 0; i < requests.length - maxCacheItems; i++) {
				previewImageCache.delete(requests[i])
			}
		})
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