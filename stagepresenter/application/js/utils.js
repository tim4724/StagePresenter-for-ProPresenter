function undefinedToEmpty(string) {
	if (string === undefined) {
		return "";
	}
	return string
}

function arrayEquals(a, b) {
	return Array.isArray(a) && Array.isArray(b) &&
		a.length === b.length && a.every((val, index) => val === b[index]);
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

function fontSizeReducer(element, maxHeight) {
	let counter = 0
	let fontSize = 1
	if (element.offsetHeight > maxHeight) {
		const steps = [0.5, 0.2, 0.05, 0.0125, 0.003125]
		for (let i = 0; i < steps.length; i++) {
			while (element.offsetHeight > maxHeight) {
				fontSize -= steps[i]
				counter += 1
				if (fontSize < 0) {
					console.log("fontSizeReducer iterations", counter)
					return
				}
				element.style.fontSize = fontSize + 'em'
			}
			if (i + 1 < steps.length) {
				fontSize += steps[i] - steps[i + 1]
				element.style.fontSize = fontSize + 'em'
			}
		}
	}
	console.log("fontSizeReducer iterations", counter)
}

function doOverlap(a, b) {
  return !(a.left > b.right || a.right < b.left || a.top > b.bottom || a.bottom < b.top)
}

function Scroller(container) {
	let scrollCounter = 0

	function scroll(deltaY, duration, doneCallback) {
		deltaY = 0 | deltaY
		if (deltaY === 0) {
			return
		}

		scrollCounter += 1
		const counter = scrollCounter

		const startMillis = Date.now()
		const startY = container.scrollTop

		function easeInOutQuad(t) {
			t /= duration / 2;
			if (t < 1) {
				return deltaY / 2 * t * t + startY
			}
			t--
			return -deltaY / 2 * (t * (t - 2) - 1) + startY
		}
		function linear(t) {
			return startY + (t / duration * deltaY)
		}

		function animateScroll() {
			if (counter !== scrollCounter) {
				// Abort, another scroll was issued
				return
			}

			const elapsedMillis = Date.now() - startMillis
			if (elapsedMillis < duration) {
				container.scrollTop = 0 | easeInOutQuad(elapsedMillis)
				requestAnimationFrame(animateScroll)
			} else {
				container.scrollTop = startY + deltaY
				if (doneCallback) {
					doneCallback()
				}
			}
		}
		animateScroll();
	}

	function scrollTo(to, duration, doneCallback) {
		scroll(to - container.scrollTop, duration, doneCallback)
	}

	return {
		scroll: scroll,
		scrollTo: scrollTo
	}
}

function renderPreviewImage(title, text, width, height, callback) {
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
		context.fillText(title, width / 2, height / 3)

		context.fillStyle = "#53B6F9"
		context.textAlign = "center"
		context.font = width / 14 + 'px ' + fontArgs[1]
		context.fillText(text, width / 2, height * 2 / 3)
	}

	canvas.convertToBlob({ type: "image/jpeg", quality: 0.9 })
	.then((blob) => {
		const reader = new FileReader()
		reader.readAsDataURL(blob)
		reader.onloadend = function() {
			const b64text = reader.result
			callback(b64text.substr(b64text.indexOf(',') + 1))
		}
	}).catch(() => {
		callback(undefined)
	})
}


// https://stackoverflow.com/a/60729670
function isEqual(obj1, obj2) {
	const obj1Keys = Object.keys(obj1);
	const obj2Keys = Object.keys(obj2);

	if(obj1Keys.length !== obj2Keys.length) {
		return false;
	}

	for (let objKey of obj1Keys) {
		if (obj1[objKey] !== obj2[objKey]) {
			if(typeof obj1[objKey] == "object" && typeof obj2[objKey] == "object") {
				if(!isEqual(obj1[objKey], obj2[objKey])) {
					return false;
				}
			} else {
				return false;
			}
		}
	}

	return true;
};
