import { Menu, Tray, nativeImage } from 'electron'
import { execFileSync } from 'node:child_process'
import { APP_NAME } from './config.js'

// True if a StatusNotifierItem host (a tray) runs in this session.
// `new Tray()` does not fail when no host runs, so ask D-Bus.
export function hasTrayHost() {
  try {
    execFileSync('busctl', ['--user', 'status', 'org.kde.StatusNotifierWatcher'], {
      stdio: 'ignore',
      timeout: 1000,
    })
    return true
  } catch {
    return false
  }
}

// Tray icon through StatusNotifierItem. On Hyprland it needs a tray host,
// for example the Waybar "tray" module. Without a host, nothing shows and
// the app still works.
export function createTray({ iconPath, unreadIconPath, actions, getCloseToTray }) {
  let tray
  try {
    tray = new Tray(nativeImage.createFromPath(iconPath))
  } catch (err) {
    console.warn(`[tray] not available: ${err.message}`)
    return null
  }

  const normal = nativeImage.createFromPath(iconPath)
  const unread = nativeImage.createFromPath(unreadIconPath)
  let count = 0

  const rebuild = () => {
    tray.setToolTip(count ? `${APP_NAME} (${count})` : APP_NAME)
    tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: `Show ${APP_NAME}`, click: actions.show },
        { label: 'Reload', click: actions.reload },
        { type: 'separator' },
        {
          label: 'Close to tray',
          type: 'checkbox',
          checked: getCloseToTray(),
          click: (item) => actions.setCloseToTray(item.checked),
        },
        { type: 'separator' },
        { label: 'Quit', click: actions.quit },
      ]),
    )
  }

  tray.on('click', actions.toggle)
  rebuild()

  return {
    setUnread(n) {
      if (n === count) return
      count = n
      tray.setImage(n ? unread : normal)
      rebuild()
    },
    refresh: rebuild,
    destroy: () => tray.destroy(),
  }
}
