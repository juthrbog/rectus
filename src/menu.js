import { Menu, clipboard, dialog } from 'electron'
import { APP_NAME } from './config.js'
import { argToUrl } from './policy.js'

// App menu. It is hidden; press Alt to show it. Accelerators work only
// while the window has focus. There are no global shortcuts.
export function setAppMenu({ getWindow, openInMain, getCloseToTray, setCloseToTray, quit }) {
  const wc = () => getWindow()?.webContents

  const openFromClipboard = () => {
    const text = clipboard.readText().trim()
    const url = argToUrl(text)
    if (url) {
      openInMain(url)
    } else {
      dialog.showMessageBox(getWindow(), {
        type: 'info',
        message: 'The clipboard has no Linear link.',
        detail: 'Copy a linear.app or linear:// link, then try again.',
      })
    }
  }

  const template = [
    {
      label: '&File',
      submenu: [
        { label: 'Open Linear link from clipboard', click: openFromClipboard },
        { type: 'separator' },
        {
          label: 'Close to tray',
          type: 'checkbox',
          checked: getCloseToTray(),
          click: (item) => setCloseToTray(item.checked),
        },
        { type: 'separator' },
        { label: `Quit ${APP_NAME}`, accelerator: 'Ctrl+Q', click: quit },
      ],
    },
    { label: '&Edit', role: 'editMenu' },
    {
      label: '&View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: '&Go',
      submenu: [
        { label: 'Back', accelerator: 'Alt+Left', click: () => wc()?.navigationHistory.goBack() },
        { label: 'Forward', accelerator: 'Alt+Right', click: () => wc()?.navigationHistory.goForward() },
        { type: 'separator' },
        { label: 'Home', click: () => openInMain('https://linear.app/') },
      ],
    },
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}
