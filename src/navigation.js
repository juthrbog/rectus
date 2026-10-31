import { BrowserWindow, shell, webContents } from 'electron'
import { spawn } from 'node:child_process'
import {
  AUTH_MODE_TTL_MS,
  classify,
  classifyPopup,
  isAppPage,
  isAuthPage,
  isSafeExternal,
  linearUrlToHttps,
  redact,
} from './policy.js'

// Per-window auth mode: webContents -> time when it ends.
// While auth mode is on, any https page may load in the window, because
// SAML and other identity providers use hosts we cannot list.
const authUntil = new WeakMap()

// Popup windows (login and integration OAuth).
const popups = new WeakSet()

function inAuthMode(wc) {
  const until = authUntil.get(wc)
  if (!until) return false
  if (Date.now() < until) return true
  authUntil.delete(wc)
  log('auth mode expired')
  return false
}

export function log(msg, url) {
  console.log(`[nav] ${msg}${url ? ` ${redact(url)}` : ''}`)
}

// Open a URL in the system browser. Only http, https and mailto are allowed.
export async function openExternal(url) {
  if (!isSafeExternal(url)) {
    log('refused external open', url)
    return
  }
  log('external', url)
  try {
    await shell.openExternal(url)
  } catch (err) {
    // Some setups (for example Hyprland without a portal) have no working
    // default handler. Try $BROWSER, then xdg-open. No shell is used.
    const cmd = (process.env.BROWSER || '').split(':')[0].trim() || 'xdg-open'
    log(`openExternal failed (${err.message}); trying ${cmd}`)
    try {
      const child = spawn(cmd, [url], { detached: true, stdio: 'ignore' })
      child.on('error', (e) => log(`cannot run ${cmd}: ${e.message}`))
      child.unref()
    } catch (e) {
      log(`cannot run ${cmd}: ${e.message}`)
    }
  }
}

// True if the navigation was started by this window itself (its main frame,
// or the browser for a server redirect), not by a frame in another window
// (for example a popup that sets opener.location) or by an iframe.
function startedByWindow(wc, event) {
  const initiator = event.initiator
  if (!initiator) return true
  try {
    return initiator === wc.mainFrame || (webContents.fromFrame(initiator) === wc && !initiator.parent)
  } catch {
    return false
  }
}

// Apply the navigation rules to one window's webContents.
// ctx.openInMain(url): load an https://linear.app URL in the main window.
export function wireNavigation(wc, ctx) {
  const updateAuthMode = (url) => {
    if (popups.has(wc)) return
    if (isAuthPage(url)) {
      if (!authUntil.has(wc)) log('auth mode on', url)
      authUntil.set(wc, Date.now() + AUTH_MODE_TTL_MS)
    } else if (isAppPage(url) && authUntil.has(wc)) {
      log('auth mode off', url)
      authUntil.delete(wc)
      // Drop the login pages (and any identity provider pages) from history,
      // so Back cannot return to them without the rules.
      wc.navigationHistory.clear()
    }
  }
  wc.on('did-navigate', (_event, url) => updateAuthMode(url))
  // Linear is a single-page app. It changes pages with the history API.
  wc.on('did-navigate-in-page', (_event, url, isMainFrame) => {
    if (isMainFrame) updateAuthMode(url)
  })

  const act = (action, url, kind) => {
    if (action === 'linear') {
      ctx.openInMain(linearUrlToHttps(url))
    } else if (action === 'download') {
      log('download', url)
      wc.downloadURL(url)
    } else if (action === 'external') {
      openExternal(url)
    } else {
      log(`denied ${kind}`, url)
    }
  }

  const guard = (event, kind) => {
    const url = event.url
    const authMode = inAuthMode(wc) && startedByWindow(wc, event)
    const action = classify(url, { authMode })
    if (action === 'internal') return
    event.preventDefault()
    act(action, url, kind)
  }

  wc.on('will-navigate', (event) => guard(event, 'navigate'))
  wc.on('will-redirect', (event) => {
    if (event.isMainFrame) guard(event, 'redirect')
  })

  wc.setWindowOpenHandler(({ url }) => {
    const action = classifyPopup(url)
    if (action === 'main') {
      ctx.openInMain(url)
      return { action: 'deny' }
    }
    // A popup may not open more popups.
    if (action === 'child' && !popups.has(wc)) {
      log('popup', url)
      const parent = BrowserWindow.fromWebContents(wc)
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          parent: parent ?? undefined,
          width: 640,
          height: 780,
          autoHideMenuBar: true,
          webPreferences: {
            sandbox: true,
            contextIsolation: true,
            nodeIntegration: false,
            webSecurity: true,
          },
        },
      }
    }
    act(action === 'child' ? 'external' : action, url, 'popup')
    return { action: 'deny' }
  })

  wc.on('did-create-window', (win) => {
    const child = win.webContents
    popups.add(child)
    // The popup may move across identity provider hosts for a limited time.
    authUntil.set(child, Date.now() + AUTH_MODE_TTL_MS)
    wireNavigation(child, ctx)
  })
}
