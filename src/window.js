import { BrowserWindow, Menu, clipboard } from 'electron'
import { APP_NAME, PARTITION, loadWindowState, saveWindowState } from './config.js'
import { openExternal } from './navigation.js'
import { isSafeExternal, unreadFromTitle } from './policy.js'

export function createMainWindow({ icon, onUnread, shouldHideOnClose }) {
  const state = loadWindowState()
  const win = new BrowserWindow({
    title: APP_NAME,
    width: state.width,
    height: state.height,
    minWidth: 480,
    minHeight: 360,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#0f1013',
    icon,
    webPreferences: {
      partition: PARTITION,
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
      spellcheck: true,
    },
  })

  // On Linux, maximize() maps the window, so call it only when it may show.
  win.once('ready-to-show', () => {
    if (state.maximized) win.maximize()
    win.show()
  })

  // Window size. Wayland does not let apps place windows, so position is not saved.
  const persist = () => {
    if (win.isDestroyed() || win.isFullScreen()) return
    const b = win.isMaximized() ? win.getNormalBounds() : win.getBounds()
    saveWindowState({ width: b.width, height: b.height, maximized: win.isMaximized() })
  }
  let timer = null
  const persistSoon = () => {
    clearTimeout(timer)
    timer = setTimeout(persist, 500)
  }
  win.on('resize', persistSoon)
  win.on('maximize', persist)
  win.on('unmaximize', persist)

  win.on('close', (event) => {
    clearTimeout(timer)
    persist()
    if (shouldHideOnClose()) {
      event.preventDefault()
      win.hide()
    }
  })

  // If the page cannot load (for example no network at login), show a
  // small error page that tries again every 10 seconds.
  win.webContents.on('did-fail-load', (_event, code, description, url, isMainFrame) => {
    if (!isMainFrame || code === -3) return // -3 is ERR_ABORTED: a rule stopped it
    console.warn(`[window] load failed: ${description} (${code})`)
    win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(errorPage(description, url))}`)
  })

  // Unread count from the page title.
  win.webContents.on('page-title-updated', (_event, title) => {
    onUnread(unreadFromTitle(title))
  })

  win.webContents.on('context-menu', (_event, params) => {
    buildContextMenu(win, params).popup({ window: win })
  })

  return win
}

function buildContextMenu(win, params) {
  const wc = win.webContents
  const items = []

  if (params.misspelledWord) {
    for (const s of params.dictionarySuggestions.slice(0, 5)) {
      items.push({ label: s, click: () => wc.replaceMisspelling(s) })
    }
    if (!params.dictionarySuggestions.length) items.push({ label: 'No suggestions', enabled: false })
    items.push({
      label: 'Add to dictionary',
      click: () => wc.session.addWordToSpellCheckerDictionary(params.misspelledWord),
    })
    items.push({ type: 'separator' })
  }

  if (params.linkURL) {
    items.push({ label: 'Copy link', click: () => clipboard.writeText(params.linkURL) })
    if (isSafeExternal(params.linkURL)) {
      items.push({ label: 'Open link in browser', click: () => openExternal(params.linkURL) })
    }
    items.push({ type: 'separator' })
  }

  const f = params.editFlags
  if (params.isEditable) {
    items.push(
      { role: 'undo', enabled: f.canUndo },
      { role: 'redo', enabled: f.canRedo },
      { type: 'separator' },
      { role: 'cut', enabled: f.canCut },
      { role: 'copy', enabled: f.canCopy },
      { role: 'paste', enabled: f.canPaste },
      { role: 'pasteAndMatchStyle', enabled: f.canPaste },
      { role: 'selectAll', enabled: f.canSelectAll },
    )
  } else if (params.selectionText) {
    items.push({ role: 'copy', enabled: f.canCopy })
  }

  if (params.mediaType === 'image' && params.srcURL) {
    if (items.length) items.push({ type: 'separator' })
    items.push({ label: 'Copy image', click: () => wc.copyImageAt(params.x, params.y) })
    items.push({ label: 'Save image as…', click: () => wc.downloadURL(params.srcURL) })
  }

  if (items.length) items.push({ type: 'separator' })
  items.push(
    { label: 'Back', enabled: wc.navigationHistory.canGoBack(), click: () => wc.navigationHistory.goBack() },
    { label: 'Forward', enabled: wc.navigationHistory.canGoForward(), click: () => wc.navigationHistory.goForward() },
    { label: 'Reload', click: () => wc.reload() },
  )

  return Menu.buildFromTemplate(items)
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
}

function errorPage(description, url) {
  const retry = url && url.startsWith('https://linear.app/') ? url : 'https://linear.app/'
  return `<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="10;url=${escapeHtml(retry)}">
<title>Rectus</title>
<body style="background:#0f1013;color:#d8d9de;font:15px system-ui,sans-serif;display:grid;place-items:center;height:90vh">
<div style="text-align:center"><p>Rectus cannot open Linear (${escapeHtml(description)}).</p>
<p>Rectus tries again in 10 seconds. <a style="color:#f5a524" href="${escapeHtml(retry)}">Try now</a></p></div>`
}
