importScripts('tiff.js')


Tiff.prototype.toOffscreenCanvas = function () {
	const width = this.width();
	const height = this.height();
	const raster = Tiff.Module.ccall('_TIFFmalloc', 'number', ['number'], [width * height * 4]);
	const result = Tiff.Module.ccall('TIFFReadRGBAImageOriented', 'number', [
		'number', 'number', 'number', 'number', 'number', 'number'], [
			this._tiffPtr, width, height, raster, 1, 0
		]);
	if (result === 0) {
		throw new Tiff.Exception('The function TIFFReadRGBAImageOriented returns NULL');
	}
	const image = Tiff.Module.HEAPU8.subarray(raster, raster + width * height * 4);
	const canvas = new OffscreenCanvas(width, height);
	const context = canvas.getContext('2d');

	const imageData = context.createImageData(width, height);
	imageData.data.set(image);
	context.putImageData(imageData, 0, 0);
	Tiff.Module.ccall('free', 'number', ['number'], [raster]);
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
		const canvas = new Tiff({buffer: arrayBuffer}).toOffscreenCanvas()
		return canvas.convertToBlob()
	}).then(blob => {
		const dataURL = new FileReaderSync().readAsDataURL(blob);
		postMessage({url: url, dataURL: dataURL});
	}).catch(e => {
		postMessage({url: url, dataURL: undefined});
	})
}
