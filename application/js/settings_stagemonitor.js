"use strict"

function StageMonitorSettings() {
    const zoomInput = document.getElementById('zoom')
    const previewIframe = document.getElementById('previewIframe')
    const flexibleSlides = document.getElementById('flexibleSlides')
    const showSidebar = document.getElementById('showSidebar')
    const improveBiblePassages = document.getElementById('improveBiblePassages')
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
            webContents.executeJavaScript('proPresenter.currentPresentationPath').then((p) => {
                console.log(p)
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
        flexibleSlides.checked = localStorage.flexibleSlides !== 'false'
        showSidebar.checked = localStorage.showSidebar === 'true'
        improveBiblePassages.checked = localStorage.improveBiblePassages !== 'false'
    }

    function zoomInputChanged() {
        zoomValue = zoomInput.value / 100.0
        if (webContents) {
            webContents.setZoomFactor(zoomValue)
        }
        updateZoomPreviewIFrame()
    }

    function flexibleSlidesChanged() {
        localStorage.flexibleSlides = flexibleSlides.checked
    }

    function showSidebarChanged() {
        localStorage.showSidebar = showSidebar.checked
    }

    function improveBiblePassagesChanged() {
        localStorage.improveBiblePassages = improveBiblePassages.checked
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

    if (BrowserWindow) {
        listenToZoomChanges()
    }
    initInputs()
    updateZoomPreviewIFrame()
    return {
        zoomChanged: zoomInputChanged,
        improveBiblePassagesChanged: improveBiblePassagesChanged,
        showSidebarChanged: showSidebarChanged,
        flexibleSlidesChanged: flexibleSlidesChanged
    }
}
