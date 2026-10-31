import { BrowserWindow, Notification, app, session } from 'electron'

// --self-test: load the Linear login page in a temporary profile, check that
// it renders, print a JSON report and exit 0 (pass) or 1 (fail).
// It needs a display and network access.
export async function runSelfTest({ userAgent, cleanup }) {
  const report = {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    platform: process.platform,
    ozone: app.commandLine.getSwitchValue('ozone-platform') || 'auto',
    sandboxed: process.argv.includes('--no-sandbox') ? false : true,
    notificationsSupported: Notification.isSupported(),
    userAgent,
    loaded: false,
    title: null,
    hasLoginForm: false,
    error: null,
  }

  const timeout = setTimeout(() => finish('timeout after 45s'), 45_000)
  let done = false

  function finish(error) {
    if (done) return
    done = true
    clearTimeout(timeout)
    report.error = error ?? null
    const ok = !error && report.loaded && report.hasLoginForm
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
    cleanup?.()
    app.exit(ok ? 0 : 1)
  }

  try {
    const ses = session.fromPartition('selftest') // not "persist:", so in memory only
    ses.setUserAgent(userAgent)
    const win = new BrowserWindow({
      show: false,
      webPreferences: { session: ses, sandbox: true, contextIsolation: true, nodeIntegration: false },
    })
    await win.loadURL('https://linear.app/login')
    report.loaded = true

    // The login page is a client-side app. Wait for a button or input to render.
    for (let i = 0; i < 40 && !done; i++) {
      report.title = win.webContents.getTitle()
      report.hasLoginForm = await win.webContents.executeJavaScript(
        `!!document.querySelector('input[type="email"], input[name="email"], button')`,
        true,
      )
      if (report.hasLoginForm) break
      await new Promise((r) => setTimeout(r, 500))
    }
    finish(report.hasLoginForm ? null : 'login form not found')
  } catch (err) {
    finish(err.message)
  }
}
