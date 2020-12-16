"use strict"

function PreviewDomUpdater(host) {
	const previewElement = document.getElementById('preview')
	const largePreviewElement = document.getElementById('largePreview')

	function changeSlide(slideUid) {
		previewElement.style.opacity = 0.3
		if (largePreviewElement.style.display !== 'none') {
			largePreviewElement.style.opacity = 0.3
		}
		
		const xhr = new XMLHttpRequest()
		xhr.responseType = 'arraybuffer'
		xhr.open('GET', 'http://' + host + '/stage/image/' + slideUid)
		xhr.onload = function (e) {
			const tiff = new Tiff({buffer: xhr.response})
			const dataUrl =  tiff.toDataURL()
			previewElement.src = dataUrl
			if (largePreviewElement.style.display !== 'none') {
				largePreviewElement.src = previewElement.src = dataUrl
				largePreviewElement.style.opacity = 1
			}
			previewElement.style.opacity = 1
		}
		xhr.onerror = function (e) {
			previewElement.src = 'black16x9.png'
		}
		xhr.send()
	}
	
	function showLargePreview() {
		if (largePreviewElement.style.display !== 'block') {
			largePreviewElement.src = previewElement.src
			largePreviewElement.style.display = 'block'
		}
	}
	
	function hideLargePreview() {
		if (largePreviewElement.style.display !== 'none') {
			largePreviewElement.src = ''
			largePreviewElement.style.display = 'none'
		}
	}
	
	return {
		changeSlide: changeSlide,
		showLargePreview: showLargePreview,
		hideLargePreview: hideLargePreview
	}
}