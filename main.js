// Modules to control application life and create native browser window
const { app, BrowserWindow, BrowserView, screen, ipcMain, Menu } = require('electron')

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

let tray = undefined
let dummyWindow = undefined
let waitingForDisplay = undefined
let stageMonitorWindow = undefined
let settingsWindow = undefined
let operatorWindow = undefined

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
    if (stageMonitorWindow && !stageMonitorWindow.isDestroyed()) {
        stageMonitorWindow.close()
    }

    localStorageGet('showOnDisplay').then(displayId => {
        const display = getDisplayById(displayId)
        if (display) {
            createStageMonitorWindow(display.bounds)
        }
    })
})

function createStageMonitorWindow(bounds) {
    if (stageMonitorWindow && !stageMonitorWindow.isDestroyed()) {
        stageMonitorWindow.close()
    }

    stageMonitorWindow = new BrowserWindow({
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
        fullscreen: app.isPackaged,
        backgroundColor: '#000000',
        darkTheme: true,
        frame: !app.isPackaged,
        title: 'Stagemonitor',
        show: false,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            enableRemoteModule: false,
            nativeWindowOpen: true
        }
    })

    // When showing the operator window, this line is important to keep the
    // stageMonitorWindow always in fullscreen always on top on mac os
    stageMonitorWindow.setAlwaysOnTop(true, "pop-up-menu")

    stageMonitorWindow.loadFile(`${__dirname}/application/stagemonitor.html`)
    function newWindow(event, url, frameName, disposition, options, additionalFeatures) {
        event.preventDefault()
        createSettingsWindow()
    }
    stageMonitorWindow.webContents.on('new-window', newWindow)
    function move(ev) {
        waitingForDisplay = true
        stageMonitorWindow.webContents.removeListener('new-window', newWindow)
        stageMonitorWindow.removeListener('move', move)
        stageMonitorWindow.close()
        stageMonitorWindow = undefined
        screenConfigChanged()
    }
    stageMonitorWindow.on('move', move)
    stageMonitorWindow.once('close', function (ev) {
        if (ev.sender === stageMonitorWindow) {
            stageMonitorWindow.webContents.removeListener('new-window', newWindow)
            stageMonitorWindow.removeListener('move', move)
            stageMonitorWindow = undefined
            if (operatorWindow != undefined && !operatorWindow.isDestroyed()) {
                operatorWindow.close()
            }
        }
    })
    stageMonitorWindow.once('closed', function (ev) {
        checkIfShouldQuit()
    })
    stageMonitorWindow.show()

    localStorageGet("showOperatorWindow").then(showOperatorWindow => {
        if (showOperatorWindow === 'true') {
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
        fullscreen: false,
        center: true,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: true
        },
    })
    settingsWindow.loadFile(`${__dirname}/application/settings.html`)
    settingsWindow.once('closed', function (ev) {
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
        const v = boundsValue.split(';')
        const b = {x: parseInt(v[0]), y: parseInt(v[1]),
            width: parseInt(v[2]), height: parseInt(v[3])}
        const display = screen.getDisplayMatching(b)
        const intersectAmount = rectIntersectionAmount(display.bounds, b)
        if (intersectAmount / (b.width * b.height) > 0.5) {
            bounds = b
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
                if (stageMonitorWindow != undefined && !stageMonitorWindow.isDestroyed()) {
                    console.log("showOperatorWindow -> false")
                    // StageMonitorWindow window has not been destroyed
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
            const display = getDisplayById(displayId)
            if (display) {
                waitingForDisplay = false
                createStageMonitorWindow(display.bounds)
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
    // TODO: Only first launch ?
    if (app.isPackaged && !app.isInApplicationsFolder()) {
        app.moveToApplicationsFolder({
          conflictHandler: (conflictType) => {
            if (conflictType === 'exists') {
              return dialog.showMessageBoxSync({
                type: 'question',
                buttons: ['Halt Move', 'Continue Move'],
                defaultId: 0,
                message: 'An app of this name already exists'
              }) === 1
            }
          }
        })
    }

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

    const displayId = await localStorageGet('showOnDisplay')
    if (displayId !== undefined && displayId !== '-1') {
        const display = getDisplayById(displayId)
        if (display) {
            waitingForDisplay = false
            createStageMonitorWindow(display.bounds)
        } else {
            console.log('Waiting for Display', displayId)
            waitingForDisplay = true
        }
    } else {
        waitingForDisplay = false
        createSettingsWindow()
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
        dummyWindow.webContents.executeJavaScript(script)
    } else {
        console.log("localStorageSet failed; Dummy window is undefined or destroyed...")
    }
}

function getDisplayById(id) {
    // Do not use '===' !
    return screen.getAllDisplays().find(d => d.id == id)
}

function rectIntersectionAmount(a, b) {
    const max = Math.max
    const min = Math.min
    return max(0, max(a.x + a.width, b.x + b.width) - min(a.x, b.x)) *
        max(0, max(a.y + a.height, b.y + b.height) - min(a.y, b.y));
}
