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
    if (stageMonitorWindow) {
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
    if (stageMonitorWindow) {
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
        title: 'Stagemonitor',
        webPreferences: {
            nodeIntegration: false,
            enableRemoteModule: false,
            nativeWindowOpen: true
        }
    })
    stageMonitorWindow.loadFile('application/stagemonitor.html')
    stageMonitorWindow.webContents.on('new-window', (event, url, frameName, disposition, options, additionalFeatures) => {
        event.preventDefault()
        createSettingsWindow()
    })
    stageMonitorWindow.on('closed', function () {
        stageMonitorWindow = undefined
    })
}

function createSettingsWindow () {
    if (settingsWindow) {
        settingsWindow.close()
    }

    settingsWindow = new BrowserWindow({
        backgroundColor: '#000000',
        darkTheme: true,
        title: 'Stagemonitor',
        width: 1000,
        height: 800,
        fullscreen: false,
        center: true,
        webPreferences: {
            nodeIntegration: true,
            enableRemoteModule: true
        }
    })
    settingsWindow.loadFile('application/settings.html')
    settingsWindow.on('closed', function () {
        settingsWindow = undefined
    })
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
    function updateSettingsWindowDisplays() {
        if (settingsWindow) {
            settingsWindow.webContents.send('updateDisplays')
        }
    }
    screen.on('display-removed', updateSettingsWindowDisplays);
    screen.on('display-added', updateSettingsWindowDisplays);
    screen.on('display-metrics-changed', updateSettingsWindowDisplays);

    const displayId = await localStorage.getItem('showOnDisplay')
    const display = getDisplayById(displayId)
    if (display) {
        createStageMonitorWindow(display.bounds)
    } else {
        createSettingsWindow()
    }
})

function getDisplayById(id) {
    // Do not use '===' !
    return screen.getAllDisplays().find(d => d.id == id)
}
