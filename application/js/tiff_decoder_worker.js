importScripts('tiff.js')


Tiff.prototype.toOffscreenCanvas = function () {
	const width = this.width();
	const height = this.height();
	const data = this.readRGBAImage()

	const canvas = new OffscreenCanvas(width, height);
	const context = canvas.getContext('2d');
	const imageData = context.createImageData(width, height);
	imageData.data.set(new Uint8Array(data));
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
		const dataURL = new FileReaderSync().readAsDataURL(blob);
		postMessage({url: url, dataURL: dataURL});
	}).catch(e => {
		console.log(e)
		postMessage({url: url, dataURL: undefined});
	})
}
