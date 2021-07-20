// Modules to control application life and create native browser window
const { app, BrowserWindow, BrowserView, screen, ipcMain, Menu, shell }
	= require('electron')

// App Icon color: #3478F6 - #53B6F9
// App Icon middle color: #4497f8

const dockMenu = Menu.buildFromTemplate([
	{
		label: 'Open Settings',
		click () { createSettingsWindow() }
	},
	{
		label: 'Open Controller',
		click () { createOperatorWindow() }
	}
])

let dummyWindow = undefined
let waitingForDisplay = undefined
let stagePresenterWindow = undefined
let settingsWindow = undefined
let operatorWindow = undefined
let welcomeWindow = undefined

if (!app.isPackaged) {
	// Enable live reload for Electron too
	require('electron-reload')(__dirname, {
		// Note that the path to electron may vary according to the main file
		electron: require(`${__dirname}/node_modules/electron`)
	})
}

app.setAboutPanelOptions({
	authors: ['Tim Vogel']
})

ipcMain.on('displaySelected', (event, arg) => {
	if (stagePresenterWindow && !stagePresenterWindow.isDestroyed()) {
		stagePresenterWindow.close()
	}

	localStorageGet('showOnDisplay').then(displayId => {
		if (displayId == "window") {
			createStagePresenterWindow(undefined)
			waitingForDisplay = false
		} else {
			const display = getDisplayById(displayId, screen.getAllDisplays())
			if (display) {
				createStagePresenterWindow(display.bounds)
			}
		}
	})
})

async function createStagePresenterWindow(displayBounds) {
	if (stagePresenterWindow && !stagePresenterWindow.isDestroyed()) {
		stagePresenterWindow.close()
	}

	if (displayBounds) {
		localStorageSet("stagePresenterWindowModeWindowBounds", '')
		localStorageSet("stagePresenterWindowModeWindowFullscreen", 'false')
		stagePresenterWindow = new BrowserWindow({
			x: displayBounds.x,
			y: displayBounds.y,
			width: displayBounds.width,
			height: displayBounds.height,
			fullscreen: true,
			backgroundColor: '#000000',
			darkTheme: true,
			title: 'StagePresenter',
			show: false,
			webPreferences: {
				nodeIntegration: false,
				contextIsolation: true,
				enableRemoteModule: false,
				nativeWindowOpen: true
			}
		})
	} else {
		let bounds = {x: undefined, y: undefined, width: 4096, height: 2304}
		const boundsValue = await localStorageGet("stagePresenterWindowModeWindowBounds")
		try {
			if (boundsValue != undefined && boundsValue.length > 0) {
				const v = boundsValue.split(';')
				const b = {x: parseInt(v[0]), y: parseInt(v[1]),
					width: parseInt(v[2]), height: parseInt(v[3])}
				const display = screen.getDisplayMatching(b)
				const intersectAmount = rectIntersectionAmount(display.bounds, b)
				if (intersectAmount / (b.width * b.height) > 0.5) {
					bounds = b
				}
			}
		} catch (e) {
			console.log("Error parsing stagePresenterWindowModeWindowBounds", e)
		}
		const isFullscreen = await localStorageGet("stagePresenterWindowModeWindowFullscreen") == 'true'

		stagePresenterWindow = new BrowserWindow({
			x: bounds.x,
			y: bounds.y,
			width: bounds.width,
			height: bounds.height,
			minWidth: 640,
			minHeight: 360,
			fullscreen: false,
			backgroundColor: '#000000',
			darkTheme: true,
			fullscreenable: true,
			fullscreen: isFullscreen,
			title: 'StagePresenter',
			show: false,
			webPreferences: {
				nodeIntegration: false,
				contextIsolation: true,
				enableRemoteModule: false,
				nativeWindowOpen: true
			}
		})
	}
	stagePresenterWindow.webContents.setMaxListeners(100)

	if (displayBounds != undefined) {
		// When showing the operator window, this line is important to keep the
		// stagePresenterWindow always in fullscreen always on top on mac os
		stagePresenterWindow.setAlwaysOnTop(true, "pop-up-menu")
		function move(ev) {
			waitingForDisplay = true
			stagePresenterWindow.removeListener('move', move)
			stagePresenterWindow.close()
			stagePresenterWindow = undefined
			screenConfigChanged()
		}
		stagePresenterWindow.on('move', move)
	}

	stagePresenterWindow.loadFile(`${__dirname}/application/stagePresenter.html`)

	stagePresenterWindow.once('close', function (ev) {
		try {
			if (ev.sender === stagePresenterWindow) {
				if (displayBounds != undefined) {
					stagePresenterWindow.removeListener('move', move)
				} else {
					const b = stagePresenterWindow.getBounds()
					const value = b.x + ";" + b.y + ";" + b.width + ";" + b.height
					localStorageSet("stagePresenterWindowModeWindowBounds", value)
					const fullscreen = stagePresenterWindow.isFullScreen()
					localStorageSet("stagePresenterWindowModeWindowFullscreen", fullscreen)
				}

				stagePresenterWindow = undefined
				if (operatorWindow != undefined && !operatorWindow.isDestroyed()) {
					operatorWindow.close()
				}
			}
		} catch (e) {
			console.log('stagePresenterWindow close did not work')
		}
	})
	stagePresenterWindow.once('closed', function (ev) {
		checkIfShouldQuit()
		if (settingsWindow && !settingsWindow.isDestroyed()) {
			settingsWindow.webContents.send('updateDisplays')
		}
		if (welcomeWindow && !welcomeWindow.isDestroyed()) {
			welcomeWindow.webContents.send('updateDisplays')
		}
	})
	stagePresenterWindow.show()

	localStorageGet("showOperatorWindow").then(showOperatorWindow => {
		if (showOperatorWindow == 'true') {
			createOperatorWindow()
		}
	})
}

function createSettingsWindow () {
	if (settingsWindow && !settingsWindow.isDestroyed()) {
		settingsWindow.close()
	}

	settingsWindow = new BrowserWindow({
		backgroundColor: '#000000',
		darkTheme: true,
		title: 'Stagemonitor Settings',
		width: 1200,
		height: 800,
		fullscreenable: false,
		maximizable: false,
		webPreferences: {
			nodeIntegration: true,
			contextIsolation: false,
			enableRemoteModule: true
		}
	})
	settingsWindow.loadFile(`${__dirname}/application/settings.html`)
	settingsWindow.webContents.setWindowOpenHandler(({ url }) => {
		shell.openExternal(url)
		return { action: 'deny' }
	});
	settingsWindow.once('closed', function (ev) {
		checkIfShouldQuit()
	})
}

function createWelcomeWindow () {
	if (welcomeWindow && !welcomeWindow.isDestroyed()) {
		welcomeWindow.close()
	}

	welcomeWindow = new BrowserWindow({
		backgroundColor: '#000000',
		darkTheme: true,
		title: 'Welcome to StagePresenter',
		width: 1024,
		height: 700,
		center: true,
		fullscreenable: false,
		maximizable: false,
		webPreferences: {
			nodeIntegration: true,
			contextIsolation: false,
			enableRemoteModule: true
		},
	})
	welcomeWindow.loadFile(`${__dirname}/application/welcome.html`)
	welcomeWindow.once('closed', function (ev) {
		checkIfShouldQuit()
	})
}

async function createOperatorWindow () {
	if (operatorWindow && !operatorWindow.isDestroyed()) {
		operatorWindow.close()
	}

	const boundsValue = await localStorageGet("operatorWindowBounds")

	let bounds = {x: undefined, y: undefined, width: 350, height: 108}
	if (boundsValue != undefined && boundsValue.length > 0) {
		// TODO: avoid controller is behind Stagemonitor
		const v = boundsValue.split(';')
		const b = {x: parseInt(v[0]), y: parseInt(v[1]),
			width: parseInt(v[2]), height: parseInt(v[3])}
		const display = screen.getDisplayMatching(b)
		let intersectsWithStagePresenterWindow = false
		if (stagePresenterWindow != undefined && !stagePresenterWindow.isDestroyed()) {
			const stagePresenterBounds = stagePresenterWindow.getBounds()
			const intersectAmount = rectIntersectionAmount(stagePresenterBounds, b)
			intersectsWithStagePresenterWindow = intersectAmount > 0
		}
		if (!intersectsWithStagePresenterWindow) {
			const intersectAmount = rectIntersectionAmount(display.bounds, b)
			if (intersectAmount / (b.width * b.height) > 0.5) {
				bounds = b
			}
		}
	}
	operatorWindow = new BrowserWindow({
		backgroundColor: '#000000',
		opacity: 0.7,
		darkTheme: true,
		title: 'Stagemonitor Controller',
		minWidth: 80,
		minHeight: 108,
		maxHeight: 256,
		x: bounds.x,
		y: bounds.y,
		width: bounds.width,
		height: bounds.height,
		show: false, // Important!
		alwaysOnTop: true,
		fullscreen: false,
		maximizable: false,
	})
	// Important to set visible on all workspaces with visibleOnFullScreen
	operatorWindow.setVisibleOnAllWorkspaces(true, {visibleOnFullScreen: true})
	operatorWindow.loadFile(`${__dirname}/application/operator.html`)

	// Show window after setting things up
	operatorWindow.show()
	localStorageSet("showOperatorWindow", true)

	// Set initial position to the bottom right
	if (bounds.x == undefined || bounds.y == undefined) {
		const pos = operatorWindow.getPosition()
		const display = screen.getDisplayNearestPoint({x: pos[0], y: pos[1]})
		bounds.x = display.bounds.x + display.bounds.width - bounds.width
		bounds.y = display.bounds.y + display.bounds.height - bounds.height
	}
	// Always set the position explicitly, because mac is reluctant sometimes
	operatorWindow.setPosition(bounds.x, bounds.y, true)

	// Gets automatically hidden for any reason, therefore show dock again
	app.dock.show()

	function focus() {
		operatorWindow.setOpacity(1.0)
	}
	operatorWindow.on('focus', focus)
	function blur() {
		operatorWindow.setOpacity(0.7)
	}
	operatorWindow.on('blur', blur)

	operatorWindow.once('close', function (ev) {
		if (ev.sender === operatorWindow) {
			const b = operatorWindow.getBounds()
			const value = b.x + ";" + b.y + ";" + b.width + ";" + b.height
			localStorageSet("operatorWindowBounds", value)
			operatorWindow = undefined
			setTimeout(function() {
				if (stagePresenterWindow != undefined && !stagePresenterWindow.isDestroyed()) {
					console.log("showOperatorWindow -> false")
					// stagePresenterWindow window has not been destroyed
					// This means only the operator window was closed
					// Therefore do not show it automatically, next time
					localStorageSet("showOperatorWindow", false)
				}
			}, 0)
		}
	})
	operatorWindow.once('closed', function (ev) {
		checkIfShouldQuit()
	})
}

let screenConfigChangedTimeout = undefined
function screenConfigChanged() {
	clearTimeout(screenConfigChangedTimeout)
	screenConfigChangedTimeout = setTimeout(async () => {
		if (settingsWindow && !settingsWindow.isDestroyed()) {
			settingsWindow.webContents.send('updateDisplays')
		}

		if (waitingForDisplay) {
			const displayId = await localStorageGet('showOnDisplay')
			const display = getDisplayById(displayId, screen.getAllDisplays())
			if (display) {
				waitingForDisplay = false
				createStagePresenterWindow(display.bounds)
			} else {
				console.log('Still waiting for display')
			}
		}
	}, 2000)
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
	const initApplicationMenu = require('./init_application_menu');
	initApplicationMenu.initApplicationMenu(app, Menu)

	app.dock.setMenu(dockMenu)

	dummyWindow = new BrowserWindow({
		show: false,
		title: 'dummyWindow',
		paintWhenInitiallyHidden: false,
		webPreferences: {
			nodeIntegration: false,
			contextIsolation: true,
			enableRemoteModule: false
		}
	})
	dummyWindow.loadFile(__filename)

	screen.on('display-removed', screenConfigChanged)
	screen.on('display-added', screenConfigChanged)
	screen.on('display-metrics-changed', screenConfigChanged)

	try {
		const version = await localStorageGet('localStorageVersion')
		if (version == undefined || version.length <= 0) {
			let features = (await localStorageGet('features')).split(' ')
			features.push('doNotShowDisabledSlides')
			await localStorageSet('features', features.join(' '))
			await localStorageSet('localStorageVersion', '1')
		}
	} catch(e) {
		console.log("localStorageVersionCheckFailed", e)
	}

	const displayId = await localStorageGet('showOnDisplay')
	if (displayId !== undefined && displayId !== '-1') {
		if (displayId == "window") {
			createStagePresenterWindow(undefined)
		} else {
			const allDisplays = screen.getAllDisplays()
			if (allDisplays.length <= 1) {
				waitingForDisplay = false
				createWelcomeWindow()
			} else {
				const display = getDisplayById(displayId, allDisplays)
				if (display) {
					waitingForDisplay = false
					// TODO: Deadlock if only one display is connected
					createStagePresenterWindow(display.bounds)
				} else {
					console.log('Waiting for Display', displayId)
					waitingForDisplay = true
				}
			}
		}
	} else {
		waitingForDisplay = false
		createWelcomeWindow()
	}
})

app.on('window-all-closed', () => {
	if (!waitingForDisplay) {
		app.quit()
	}
})

function checkIfShouldQuit() {
	if (waitingForDisplay) {
		return
	}
	const wins = BrowserWindow.getAllWindows()
	if (wins.length === 0 || wins.length === 1 && wins[0] === dummyWindow) {
		app.quit()
	}
}

function localStorageGet(key) {
	return dummyWindow.webContents.executeJavaScript('localStorage.' + key)
}

function localStorageSet(key, value) {
	if (dummyWindow != undefined && !dummyWindow.isDestroyed()) {
		const script = 'localStorage.' + key + ' = "' + value + '"'
		return dummyWindow.webContents.executeJavaScript(script)
	} else {
		console.log("localStorageSet failed; Dummy window is undefined or destroyed...")
	}
}

function getDisplayById(id, allDisplays) {
	// Do not use '===' !
	return allDisplays.find(d => d.id == id)
}

function rectIntersectionAmount(a, b) {
	const max = Math.max
	const min = Math.min

	const top = max(a.y, b.y)
  	const bottom = min(a.y + a.height, b.y + b.height)
	const left = max(a.x, b.x)
	const right = min(a.x + a.width, b.x + b.width)
	return max(0, right - left) * max(0, bottom - top)
}
