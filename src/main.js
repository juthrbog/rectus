import { app, dialog } from 'electron'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { APP_ID, APP_NAME, PARTITION, getSettings, updateSettings } from './config.js'
import { setAppMenu } from './menu.js'
import { log, wireNavigation } from './navigation.js'
import { ORIGIN, cleanUserAgent, urlFromArgv } from './policy.js'
import { runSelfTest } from './selftest.js'
import { setupSession } from './session.js'
import { createTray, hasTrayHost } from './tray.js'
import { createMainWindow } from './window.js'

const ASSETS = path.join(import.meta.dirname, '..', 'assets')
const SELF_TEST = process.argv.includes('--self-test')

app.setName(APP_NAME)
app.setDesktopName(`${APP_ID}.desktop`)
app.enableSandbox()
const userAgent = cleanUserAgent(process.versions.chrome)
app.userAgentFallback = userAgent

// The self-test uses a temporary profile, so it may run next to the app.
let selfTestDir = null
if (SELF_TEST) {
  selfTestDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rectus-selftest-'))
  app.setPath('userData', selfTestDir)
  app.setPath('sessionData', selfTestDir)
}

if (!SELF_TEST && !app.requestSingleInstanceLock()) {
  app.quit()
} else if (SELF_TEST) {
  app.whenReady().then(() =>
    runSelfTest({
      userAgent,
      cleanup: () => fs.rmSync(selfTestDir, { recursive: true, force: true }),
    }),
  )
} else {
  start()
}

function start() {
  let win = null
  let tray = null
  let quitting = false
  let pendingUrl = urlFromArgv(process.argv.slice(1))

  // loadURL rejects when a rule cancels the navigation (ERR_ABORTED).
  const load = (url) =>
    win?.loadURL(url).catch((err) => {
      if (err.code !== 'ERR_ABORTED') log(`load failed: ${err.message}`, url)
    })

  const show = () => {
    if (!win) return
    if (win.isMinimized()) win.restore()
    win.show()
    win.focus()
  }

  const openInMain = (url) => {
    if (!url) return
    if (!win) {
      pendingUrl = url
      return
    }
    log('open', url)
    load(url)
    show()
  }

  const setCloseToTray = (value) => {
    if (value && !hasTrayHost()) {
      dialog.showMessageBox(win ?? undefined, {
        type: 'warning',
        message: 'No tray was found.',
        detail:
          'Rectus needs a StatusNotifierItem tray (for example the Waybar "tray" module) to keep running after you close the window. Until a tray runs, closing the window quits Rectus.',
      })
    }
    updateSettings({ closeToTray: value })
    tray?.refresh()
    buildMenu()
  }

  const quit = () => {
    quitting = true
    app.quit()
  }

  const buildMenu = () =>
    setAppMenu({
      getWindow: () => win,
      openInMain,
      getCloseToTray: () => getSettings().closeToTray,
      setCloseToTray,
      quit,
    })

  app.on('second-instance', (_event, argv) => {
    const url = urlFromArgv(argv.slice(1))
    if (url) openInMain(url)
    else show()
  })

  app.on('before-quit', () => {
    quitting = true
  })

  // Block <webview> in every webContents.
  app.on('web-contents-created', (_event, wc) => {
    wc.on('will-attach-webview', (e) => e.preventDefault())
  })

  app.whenReady().then(() => {
    setupSession(PARTITION, { userAgent, spellcheckLanguages: getSettings().spellcheckLanguages })
    buildMenu()

    tray = createTray({
      iconPath: path.join(ASSETS, 'tray.png'),
      unreadIconPath: path.join(ASSETS, 'tray-unread.png'),
      getCloseToTray: () => getSettings().closeToTray,
      actions: {
        show,
        toggle: () => (win?.isVisible() && win.isFocused() ? win.hide() : show()),
        reload: () => win?.webContents.reload(),
        setCloseToTray,
        quit,
      },
    })

    win = createMainWindow({
      icon: path.join(ASSETS, 'icon.png'),
      // Hide instead of close only when the user asked for it and a tray
      // host runs. Without a tray host the window could not come back.
      shouldHideOnClose: () => !quitting && !!tray && getSettings().closeToTray && hasTrayHost(),
      onUnread: (n) => {
        tray?.setUnread(n)
        app.setBadgeCount(n)
      },
    })
    win.on('closed', () => {
      win = null
    })

    // A page beforeunload handler (for example unsynced changes) tried to
    // stop the window from closing. Ask the user.
    win.webContents.on('will-prevent-unload', (event) => {
      const choice = dialog.showMessageBoxSync(win, {
        type: 'question',
        buttons: ['Stay', 'Close anyway'],
        defaultId: 0,
        cancelId: 0,
        message: 'Linear has changes that are not saved yet.',
        detail: 'If you close now, you can lose these changes.',
      })
      if (choice === 1) event.preventDefault()
      else quitting = false
    })

    wireNavigation(win.webContents, { openInMain })

    const first = pendingUrl ?? `${ORIGIN}/`
    pendingUrl = null
    load(first)
  })

  app.on('window-all-closed', () => app.quit())
}
