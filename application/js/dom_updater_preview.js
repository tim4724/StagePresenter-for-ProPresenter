"use strict"

const maxCacheItems = 24

function PreviewDomUpdater(host) {
	const baseUrl = 'http://' + host + '/stage/image/'
	const previewElement = document.getElementById('preview')
	const largePreviewElement = document.getElementById('largePreview')
	
	let previewImageCache = undefined
	caches.open('previewImageCache').then(cache => {
		previewImageCache = cache
	})

	function changeSlide(uid, nextSlideUid) {
		function show(dataUrl) {
			previewElement.src = dataUrl
			previewElement.style.opacity = 1
			if (largePreviewElement.style.display !== 'none') {
				largePreviewElement.src = dataUrl
				largePreviewElement.style.opacity = 1
			}
		}
		
		const url = baseUrl + uid
		previewImageCache.match(url).then(response => {
			if (response !== undefined) {
				return response.text().then(show)
			} else {
				// Make transparent, we need to load the image from the network
				previewElement.style.opacity = 0
				if (largePreviewElement.style.display !== 'none') {
					largePreviewElement.style.opacity = 0
				}
				return loadTiffImageAsDataUrl(url).then(dataUrl => {
					show(dataUrl)
					previewImageCache.put(url, new Response(dataUrl))
				})
			}
		}).catch(eror => {
			previewElement.src = '' // Will show the alt text of that image
			largePreviewElement.src = ''
			largePreviewElement.display = 'none'
		}).finally(() => {
			previewImageCache.keys().then(function(requests) {
				// Cache the next image
				if (nextSlideUid && nextSlideUid !== '00000000-0000-0000-0000-000000000000') {
					const url = baseUrl + nextSlideUid
					if (!requests.some(request => request.url === url)) {
						loadTiffImageAsDataUrl(url).then(dataUrl => {
							previewImageCache.put(url, new Response(dataUrl))
						})
					}
				}
				
				// Delete old cache entries
				for (let i = 0; i < requests.length - maxCacheItems; i++) {
					previewImageCache.delete(requests[i])
				}
			})
		})
	}
	
	function loadTiffImageAsDataUrl(url) {
		return fetch(url).then(response => {
			if (response.ok) {
				return response.arrayBuffer().then(arrayBuffer => {
					return Promise.resolve(new Tiff({buffer: arrayBuffer}).toDataURL())
				})
			} else {
				throw new TypeError('bad response status')
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