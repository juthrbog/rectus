// Pure URL rules. This file must not import electron, so `node --test` can load it.

export const ORIGIN = 'https://linear.app'

// How long a window may stay in "auth mode" (see classify) without
// reaching a normal Linear page again.
export const AUTH_MODE_TTL_MS = 10 * 60 * 1000

const AUTH_PATH = /^\/(login|signup|auth|sso|saml|oauth)(\/|$)/i

const GOOGLE_AUTH_HOSTS = new Set([
  'accounts.google.com',
  'accounts.youtube.com',
])

// Hosts whose files the app downloads with the Linear session instead of
// showing them in a window (issue attachments).
const DOWNLOAD_HOSTS = new Set(['uploads.linear.app'])

// Login and integration OAuth pages that linear.app may open in a popup
// window. Only these entry points get a popup. Other pages on the same
// hosts (for example a GitHub repository link) open in the browser.
const OAUTH_POPUPS = [
  { host: 'accounts.google.com' },
  { host: 'login.microsoftonline.com' },
  { host: 'github.com', path: /^\/(login|apps\/[^/]+\/installations|sessions\/two-factor)(\/|$)/ },
  { host: 'gitlab.com', path: /^\/(oauth\/authorize|users\/sign_in)(\/|$)/ },
  { host: 'slack.com', path: /^\/(oauth|openid)\// },
  { host: 'www.figma.com', path: /^\/oauth(\/|$)/ },
]

function parse(raw) {
  try {
    return new URL(raw)
  } catch {
    return null
  }
}

// The only host that loads as a page in the main window.
export function isAppHost(host) {
  return host.toLowerCase() === 'linear.app'
}

export function isGoogleAuthHost(host) {
  return GOOGLE_AUTH_HOSTS.has(host.toLowerCase())
}

// True for Linear login, signup and SSO pages. Arriving on one of these
// turns on auth mode for the window.
export function isAuthPage(raw) {
  const u = parse(raw)
  return !!u && u.protocol === 'https:' && isAppHost(u.hostname) && AUTH_PATH.test(u.pathname)
}

// True for a normal (non-auth) Linear page. Arriving on one turns auth mode off.
export function isAppPage(raw) {
  const u = parse(raw)
  return !!u && u.protocol === 'https:' && isAppHost(u.hostname) && !AUTH_PATH.test(u.pathname)
}

// Map a linear:// URL to https://linear.app/...
// Accepts linear://linear.app/<path> and linear://<workspace>/<path>.
// The result is always on https://linear.app, or null.
export function linearUrlToHttps(raw) {
  const u = parse(raw)
  if (!u || u.protocol !== 'linear:') return null
  const host = u.hostname.toLowerCase()
  let path = u.pathname || '/'
  if (host && host !== 'linear.app') {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(host)) return null
    path = `/${host}${path === '/' ? '' : path}`
  }
  const out = new URL(ORIGIN)
  out.pathname = path.replace(/\/{2,}/g, '/')
  out.search = u.search
  out.hash = u.hash
  return out.origin === ORIGIN ? out.href : null
}

// Turn a command-line argument into a URL to open, or null.
export function argToUrl(arg) {
  if (typeof arg !== 'string' || arg.startsWith('-')) return null
  if (/^linear:/i.test(arg)) return linearUrlToHttps(arg)
  const u = parse(arg)
  if (u && u.protocol === 'https:' && u.origin === ORIGIN) return u.href
  return null
}

export function urlFromArgv(argv) {
  for (const arg of argv) {
    const url = argToUrl(arg)
    if (url) return url
  }
  return null
}

// Decide what to do with a top-level navigation in a window.
// Returns one of:
//   'internal' - load it in the window
//   'linear'   - a linear:// URL; map it with linearUrlToHttps and load that
//   'download' - download the file with the Linear session
//   'external' - open it in the system browser
//   'deny'     - block it
// opts.authMode: the window is in a login flow, so any https page may load
//   (SAML and other identity providers use hosts we cannot list).
export function classify(raw, { authMode = false } = {}) {
  const u = parse(raw)
  if (!u) return 'deny'
  switch (u.protocol) {
    case 'linear:':
      return linearUrlToHttps(raw) ? 'linear' : 'deny'
    case 'mailto:':
      return 'external'
    case 'http:':
      return 'external'
    case 'https:':
      if (isAppHost(u.hostname)) return 'internal'
      if (DOWNLOAD_HOSTS.has(u.hostname.toLowerCase())) return 'download'
      if (isGoogleAuthHost(u.hostname)) return 'internal'
      if (authMode) return 'internal'
      return 'external'
    default:
      return 'deny'
  }
}

// Decide what to do with window.open() / target=_blank from a window.
// Returns one of:
//   'main'     - load it in the main window instead of a popup
//   'child'    - allow a popup window (login and integration OAuth)
//   'linear'   - a linear:// URL
//   'download' - download the file with the Linear session
//   'external' - open it in the system browser
//   'deny'     - block it
export function classifyPopup(raw) {
  const u = parse(raw)
  if (!u) return 'deny'
  if (u.protocol === 'linear:') return linearUrlToHttps(raw) ? 'linear' : 'deny'
  if (u.protocol === 'https:') {
    if (u.origin === ORIGIN) return 'main'
    if (DOWNLOAD_HOSTS.has(u.hostname.toLowerCase())) return 'download'
    if (isOAuthPopup(u)) return 'child'
    return 'external'
  }
  if (u.protocol === 'http:' || u.protocol === 'mailto:') return 'external'
  return 'deny'
}

function isOAuthPopup(u) {
  const host = u.hostname.toLowerCase()
  return OAUTH_POPUPS.some((e) => {
    const hostOk = e.host === host || (e.host === 'slack.com' && host.endsWith('.slack.com'))
    return hostOk && (!e.path || e.path.test(u.pathname))
  })
}

// Only these schemes may go to the system browser.
export function isSafeExternal(raw) {
  const u = parse(raw)
  return !!u && ['https:', 'http:', 'mailto:'].includes(u.protocol)
}

// Remove secrets from a URL before it goes to a log.
export function redact(raw) {
  const u = parse(raw)
  if (!u) return '<invalid url>'
  for (const key of [...u.searchParams.keys()]) {
    if (/code|state|token|secret|key|password|session|sig/i.test(key)) u.searchParams.set(key, 'REDACTED')
  }
  u.hash = ''
  u.username = ''
  u.password = ''
  return u.href
}

// Read an unread count from a page title like "(3) Inbox".
export function unreadFromTitle(title) {
  const m = /^\s*\((\d+)\+?\)/.exec(title || '')
  return m ? Number(m[1]) : 0
}

// Chrome user agent without "Electron/x" or an app token. Google refuses
// sign-in for user agents it sees as embedded.
export function cleanUserAgent(chromeVersion) {
  const major = String(chromeVersion).split('.')[0]
  return `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${major}.0.0.0 Safari/537.36`
}
