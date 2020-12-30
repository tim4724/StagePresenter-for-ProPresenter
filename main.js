// Modules to control application life and create native browser window
const { app, BrowserWindow, BrowserView, screen, ipcMain, Menu } = require('electron')

const dockMenu = Menu.buildFromTemplate([
    {
        label: 'Settings',
        click () { createSettingsWindow() }
    }
])

let dummyWindow = undefined
let waitingForDisplay = undefined
let stageMonitorWindow = undefined
let settingsWindow = undefined

if (!app.isPackaged) {
    // Enable live reload for Electron too
    require('electron-reload')(__dirname, {
        // Note that the path to electron may vary according to the main file
        electron: require(`${__dirname}/node_modules/electron`)
    })
}

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
        fullscreen: true,
        backgroundColor: '#000000',
        darkTheme: true,
        frame: !app.isPackaged,
        title: 'Stagemonitor',
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            enableRemoteModule: false,
            nativeWindowOpen: true
        }
    })
    stageMonitorWindow.loadFile('application/stagemonitor.html')
    stageMonitorWindow.webContents.on('new-window', (event, url, frameName, disposition, options, additionalFeatures) => {
        event.preventDefault()
        createSettingsWindow()
    })
    stageMonitorWindow.on('move', function (ev) {
        waitingForDisplay = true
        stageMonitorWindow.close()
        stageMonitorWindow = undefined
        screenConfigChanged()
    })
    stageMonitorWindow.on('close', function (ev) {
        if (ev.sender === stageMonitorWindow) {
            stageMonitorWindow = undefined
        }
    })
    stageMonitorWindow.on('closed', function (ev) {
        checkIfShouldQuit()
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
    settingsWindow.once('ready-to-show', (ev) => {
        settingsWindow.webContents.on('zoom-changed', (ev, s) => {
        })
    })
    settingsWindow.loadFile('application/settings.html')
    settingsWindow.on('close', function (ev) {
        if (ev === settingsWindow) {
            settingsWindow = undefined
        }
    })
    settingsWindow.on('closed', function (ev) {
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
    // TODO: Only on mac?
    if (app.isPackaged) {
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
    if (displayId) {
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
    return dummyWindow.webContents.executeJavaScript('localStorage.' + key);
}

function getDisplayById(id) {
    // Do not use '===' !
    return screen.getAllDisplays().find(d => d.id == id)
}
