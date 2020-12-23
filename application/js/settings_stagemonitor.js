function StagemonitorSettings() {
    let screen, app, ipcRenderer
    try {
        let remote
        ({ remote, ipcRenderer } = require('electron'))
        screen = remote.screen
        app = remote.app
    } catch (e) {
    }
    if (!screen || !app || !ipcRenderer) {
        console.log('electron remote and ipcRenderer are not available')
    }

    document.getElementById('electronAppSettings').style.display = ''
    const displaySelectElement = document.getElementById('showOnDisplay')
    const displayNoneOptionElement = document.getElementById('showOnDisplayNone')

    const autoStartElement = document.getElementById('autoStart')
    autoStartElement.checked = app.getLoginItemSettings().openAtLogin

    ipcRenderer.on('updateDisplays', updateDisplaySelect)

    function updateDisplaySelect() {
        displaySelectElement.innerText = ''

        displaySelectElement.appendChild(displayNoneOptionElement)

        const showOnDisplay = localStorage.showOnDisplay || -1
        console.log('showOnDisplay', showOnDisplay)

        const displays = screen.getAllDisplays()
        const primaryDisplayId = screen.getPrimaryDisplay().id
        for (let i = 0; i < displays.length; i++) {
            const display = displays[i]

            let displayName = 'Display ' + (i + 1)

            let additionalDetails = []
            if (display.id === primaryDisplayId) {
                additionalDetails.push('Primary')
            }
            if(display.internal) {
                additionalDetails.push('Internal')
            }

            if (additionalDetails.length > 0) {
                displayName += ' (' + additionalDetails.join(', ') + ')'
            }
            displayName += ' ' + display.size.width + 'x' + display.size.height

            const newOptionElement = displayNoneOptionElement.cloneNode()
            newOptionElement.id = display.id
            newOptionElement.value = display.id
            newOptionElement.innerText = displayName

            if (showOnDisplay == '' + display.id) {
                newOptionElement.selected = true
            }

            displaySelectElement.appendChild(newOptionElement)
        }
    }

    function startAtLogin(input) {
        app.setLoginItemSettings({openAtLogin: input.checked})
    }

    function onDisplaySelected(option) {
        localStorage.showOnDisplay = option.value
        ipcRenderer.send('displaySelected')
    }

    return {
        onDisplaySelected: onDisplaySelected,
        startAtLogin: startAtLogin
    }
}
