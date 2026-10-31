import { session } from 'electron'
import { ORIGIN } from './policy.js'

// Permissions linear.app may get. Everything else is denied.
const ALLOWED = new Set(['notifications', 'clipboard-sanitized-write', 'fullscreen'])

function originOf(raw) {
  try {
    return new URL(raw).origin
  } catch {
    return null
  }
}

export function setupSession(partition, { userAgent, spellcheckLanguages }) {
  const ses = session.fromPartition(partition)
  ses.setUserAgent(userAgent)

  ses.setPermissionRequestHandler((wc, permission, callback, details) => {
    const origin = originOf(details?.requestingUrl ?? wc?.getURL())
    const ok = origin === ORIGIN && ALLOWED.has(permission)
    if (!ok) console.log(`[perm] denied ${permission} for ${origin}`)
    callback(ok)
  })

  ses.setPermissionCheckHandler((_wc, permission, requestingOrigin) => {
    return originOf(requestingOrigin) === ORIGIN && ALLOWED.has(permission)
  })

  try {
    const available = new Set(ses.availableSpellCheckerLanguages)
    const langs = (spellcheckLanguages || []).filter((l) => available.has(l))
    if (langs.length) ses.setSpellCheckerLanguages(langs)
  } catch (err) {
    console.warn(`[session] spellcheck: ${err.message}`)
  }

  return ses
}
