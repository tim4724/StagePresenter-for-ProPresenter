"use strict"

function StageMonitorSettings() {
    const previewIframe = document.getElementById('previewIframe')
    const settingsGroupElement = document.getElementById('stagemonitorSettingsGroup')
    const zoomInput = document.getElementById('zoom')
    const showSidebar = document.getElementById('showSidebar')
    const previewCheckboxInput = document.getElementById('showSmallSlidePreview')
    const playlistCheckboxInput = document.getElementById('showPlaylist')
    const sidebarMaxSizeInput = document.getElementById('sidebarMaxSize')
    const minimumVideoLengthForTimer = document.getElementById('minimumVideoLengthForTimer')
    const alignLeftCharactersThreshold = document.getElementById('alignLeftCharactersThreshold')

    const checkBoxInputs = settingsGroupElement.querySelectorAll('input[type="checkbox"]')
    const numberInputs = settingsGroupElement.querySelectorAll('input[type="number"]')

    let zoomValue = 1

    let BrowserWindow
    try {
        const { remote } = require('electron')
        BrowserWindow = remote.BrowserWindow
    } catch (e) {
        document.getElementById('zoomSetting').style.display = 'none'
    }

    let webContents = undefined
    let width = 1920
    let height = 1080

    function listenToZoomChanges() {
        const wins = BrowserWindow.getAllWindows()
        const stagemonitorWindow = wins.find(w => w.title === 'Stage Monitor')
        if (stagemonitorWindow && stagemonitorWindow.webContents) {
            webContents = stagemonitorWindow.webContents
            webContents.executeJavaScript('proPresenter.exportState()').then((p) => {
                previewIframe.contentWindow.window.proPresenter.importState(p)
            })

            stagemonitorWindow.once('close', () => {
                clearInterval(getZoomValue)
                setTimeout(listenToZoomChanges, 1000)
            })

            function getZoomValue() {
                zoomInput.value = 0 | (webContents.zoomFactor * 100)
                zoomValue = webContents.zoomFactor
                updateZoomPreviewIFrame()
            }
            const getZoomValueInterval = setInterval(getZoomValue, 1000)

            const size = stagemonitorWindow.getContentSize()
            width = size[0]
            height = size[1]
        }  else {
            setTimeout(listenToZoomChanges, 1000)
        }
    }

    function initInputs() {
        if (localStorage.features === undefined) {
            localStorage.features = 'flexibleSlides improveBiblePassages showSidebarBottom onlyFirstTextInSlide'
        }
        if (localStorage.sidebarMaxSize === undefined) {
            localStorage.sidebarMaxSize = 150
        }
        if (localStorage.minimumVideoLength === undefined) {
			localStorage.minimumVideoLength = '00:01:00'
		}
        if (localStorage.alignLeftCharactersThreshold === undefined) {
			localStorage.alignLeftCharactersThreshold = 60
		}

        let features = localStorage.features.split(' ')

        for (const checkbox of checkBoxInputs) {
            checkbox.checked = features.includes(checkbox.id)
        }

        for (const number of numberInputs) {
            if(localStorage[number.id]) {
                number.value = localStorage[number.id]
            }
        }

        for (const option of showSidebar.options) {
            if (features.includes(option.value)) {
                option.selected = true;
                break;
            }
        }

        sidebarMaxSizeInput.value = localStorage.sidebarMaxSize

        if (!features.includes('showPlaylist') && !features.includes('showSmallSlidePreview')
            || !features.includes('showSidebarBottom') && !features.includes('showSidebarLeft')) {
            sidebarMaxSizeInput.disabled = true
        } else {
            sidebarMaxSizeInput.disabled = false
        }

        if (!features.includes('showSidebarBottom')
                && !features.includes('showSidebarLeft')) {
            previewCheckboxInput.disabled = true
            playlistCheckboxInput.disabled = true
        } else {
            previewCheckboxInput.disabled = false
            playlistCheckboxInput.disabled = false
        }

        alignLeftCharactersThreshold.value = localStorage.alignLeftCharactersThreshold
        minimumVideoLengthForTimer.value = localStorage.minimumVideoLength
    }

    function zoomInputChanged() {
        zoomValue = zoomInput.value / 100.0
        if (webContents) {
            webContents.setZoomFactor(zoomValue)
        }
        updateZoomPreviewIFrame()
    }

    function checkBoxChanged(element) {
        let features = localStorage.features.split(' ')
        if (element.checked) {
            if (!localStorage.features.includes(element.id)) {
                features.push(element.id)
            }
        } else {
            features = features.filter(f => f !== element.id)
        }
        localStorage.features = features.join(' ')
        initInputs()
    }

    function selectChanged(select) {
        let features = localStorage.features.split(' ')
        let changedFeature = false
        for (const option of select.options) {
            if (option.selected) {
                if (!features.includes(option.value)) {
                    features.push(select.value)
                    changedFeature = true
                }
            } else if(features.includes(option.value)) {
                features = features.filter(f => f !== option.value)
            }
        }
        localStorage.features = features.join(' ')

        if(select.id === 'showSidebar' && changedFeature) {
            if (features.includes('showSidebarBottom')) {
                localStorage.sidebarMaxSize = 150
                features = features.filter(f => !['showSmallSlidePreview','showPlaylist'].includes(f))
            } else if(features.includes('showSidebarLeft')) {
                localStorage.sidebarMaxSize = 340
                if (!features.includes('showSmallSlidePreview')) {
                    features.push('showSmallSlidePreview')
                }
                if (!features.includes('showPlaylist')) {
                    features.push('showPlaylist')
                }
            }

            localStorage.features = features.join(' ')
            initInputs()
        }
    }

    function sidebarMaxSizeChanged() {
        localStorage.sidebarMaxSize = sidebarMaxSizeInput.value
    }

    function minimumVideoLengthForTimerChanged() {
        let minimumVideoLength = minimumVideoLengthForTimer.value
        if (minimumVideoLength.length == 5) {
            minimumVideoLength = minimumVideoLength + ':00'
        }
        localStorage.minimumVideoLength = minimumVideoLength
    }

    function updateZoomPreviewIFrame() {
        const previewIFrameWidth = previewIframe.clientWidth
        previewIframe.height = previewIFrameWidth * height / width
        let scale = previewIFrameWidth / width * zoomValue

        const contentWindow = previewIframe.contentWindow
        if(contentWindow) {
            const body = contentWindow.window.document.body

            body.style.zoom = scale
            body.style.height = 1 / scale * 100 + 'vh'
        }
    }

    function alignLeftCharactersThresholdChanged() {
        localStorage.alignLeftCharactersThreshold
            = alignLeftCharactersThreshold.value
    }

    function numberInputChanged(element) {
        localStorage[element.id] = element.value
    }

    if (BrowserWindow) {
        listenToZoomChanges()
    }
    initInputs()
    updateZoomPreviewIFrame()
    return {
        zoomChanged: zoomInputChanged,
        sidebarMaxSizeChanged: sidebarMaxSizeChanged,
        checkBoxChanged: checkBoxChanged,
        selectChanged: selectChanged,
        minimumVideoLengthForTimerChanged: minimumVideoLengthForTimerChanged,
        alignLeftCharactersThresholdChanged: alignLeftCharactersThresholdChanged,
        numberInputChanged: numberInputChanged
    }
}
