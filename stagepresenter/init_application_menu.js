module.exports = {
  initApplicationMenu: initApplicationMenu
}

function initApplicationMenu(app, Menu) {
    const isMac = process.platform === 'darwin'

    const template = [
      // { role: 'appMenu' }
      ...(isMac ? [{
        label: app.name,
        submenu: [
          { role: 'about' },
          { type: 'separator' },
          { role: 'services' },
          { type: 'separator' },
          { role: 'hide' },
          { role: 'hideothers' },
          { role: 'unhide' },
          { type: 'separator' },
          { role: 'quit' }
        ]
      }] : []),
      // { role: 'fileMenu' }
      {
        label: 'File',
        submenu: [
          isMac ? { role: 'close' } : { role: 'quit' }
        ]
      },
      // { role: 'viewMenu' }
      {
        label: 'View',
        submenu: (app.isPackaged ? [
              { role: 'resetZoom' },
              { role: 'zoomIn' },
              { role: 'zoomOut' }
          ] : [
              { role: 'reload' },
              { role: 'forceReload' },
              { role: 'toggleDevTools' },
              { type: 'separator' },
              { role: 'resetZoom' },
              { role: 'zoomIn' },
              { role: 'zoomOut' }
          ])
      },
      // { role: 'windowMenu' }
      {
        label: 'Window',
        submenu: [
          { role: 'minimize' },
          ...(isMac ? [
            { type: 'separator' },
            { role: 'front' }
          ] : [
            { role: 'close' }
          ])
        ]
      },
      {
        role: 'help',
        submenu: [
          {
            label: 'Learn More',
            click: async () => {
              const { shell } = require('electron')
              await shell.openExternal('https://stagepresenter.com')
            }
        },
        {
          label: 'View project on Github',
          click: async () => {
            const { shell } = require('electron')
            await shell.openExternal('https://github.com/tim4724/StagePresenter-for-ProPresenter')
          }
        }
        ]
      }
    ]

    const menu = Menu.buildFromTemplate(template)
    Menu.setApplicationMenu(menu)
}
