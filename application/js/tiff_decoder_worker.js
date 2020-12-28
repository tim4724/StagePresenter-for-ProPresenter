importScripts('tiff.js')

Tiff.prototype.bitDepth = function () {
	return this.getField(Tiff.Tag.BITSPERSAMPLE);
};

Tiff.prototype.toOffscreenCanvas = function () {
	const width = this.width()
	const height = this.height()
	const data = new Uint8Array(this.readRGBAImage())

	/*
	// TODO: This is so stupid :(
	const normalize = true
	if (normalize) {
		let maxValue = 1
		data.forEach(element => {
			if (element > maxValue) {
				maxValue = element
			}
		});
		const factor = 255.0 / maxValue
		data.forEach(function(element, index) {
  			data[index] = element * factor
		});
	}*/

	const canvas = new OffscreenCanvas(width, height);
	const context = canvas.getContext('2d');
	const imageData = context.createImageData(width, height);
	imageData.data.set(data);
	context.putImageData(imageData, 0, 0);
	return canvas;
};

onmessage = function(e) {
	const url = e.data
	fetch(url).then(response => {
		if (response.ok) {
			return response.arrayBuffer()
		} else {
			throw new TypeError('bad response status')
		}
	}).then(arrayBuffer => {
		Tiff.initialize({TOTAL_MEMORY: arrayBuffer.byteLength})
		const canvas = new Tiff({buffer: arrayBuffer}).toOffscreenCanvas()
		return canvas.convertToBlob()
	}).then(blob => {
		const objectURL = URL.createObjectURL(blob)
		postMessage({url: url, objectURL: objectURL});
	}).catch(e => {
		console.log(e)
		postMessage({url: url, objectURL: undefined});
	})
}
