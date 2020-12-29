// Modules to control application life and create native browser window
const { app, BrowserWindow, BrowserView, screen, ipcMain } = require('electron')
const { localStorage } = require('electron-browser-storage');

let stageMonitorWindow = undefined
let settingsWindow = undefined
let settingsWindow2 = undefined

// Enable live reload for Electron too
require('electron-reload')(__dirname, {
    // Note that the path to electron may vary according to the main file
    electron: require(`${__dirname}/node_modules/electron`)
});

ipcMain.on('displaySelected', (event, arg) => {
    if (stageMonitorWindow && !stageMonitorWindow.isDestroyed()) {
        stageMonitorWindow.close()
    }

    localStorage.getItem('showOnDisplay').then(displayId => {
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
        frame: false,
        title: 'Stagemonitor',
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            enableRemoteModule: false,
            nativeWindowOpen: true
        }
    })
    stageMonitorWindow.loadFile('application/stagemonitor.html')
    console.log('stageMonitorWindow created')
    stageMonitorWindow.webContents.on('new-window', (event, url, frameName, disposition, options, additionalFeatures) => {
        event.preventDefault()
        createSettingsWindow()
    })
    stageMonitorWindow.on('close', function (ev) {
        if (ev.sender === stageMonitorWindow) {
            stageMonitorWindow = undefined
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
        title: 'Stagemonitor',
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
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
    function updateSettingsWindowDisplays() {
        if (settingsWindow && !settingsWindow.isDestroyed()) {
            settingsWindow.webContents.send('updateDisplays')
        }
    }
    screen.on('display-removed', updateSettingsWindowDisplays);
    screen.on('display-added', updateSettingsWindowDisplays);
    screen.on('display-metrics-changed', updateSettingsWindowDisplays);

    const displayId = await localStorage.getItem('showOnDisplay')

    // TODO: Wait for display, if not connected

    const display = getDisplayById(displayId)
    if (display) {
        createStageMonitorWindow(display.bounds)
    } else {
        createSettingsWindow()

        if (process.defaultApp === false) {
            // TODO: Only first launch ?
            // TODO: Only on mac
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
    }
})

function getDisplayById(id) {
    // Do not use '===' !
    return screen.getAllDisplays().find(d => d.id == id)
}
