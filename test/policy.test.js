import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  argToUrl,
  classify,
  classifyPopup,
  cleanUserAgent,
  isAppPage,
  isAuthPage,
  isSafeExternal,
  linearUrlToHttps,
  redact,
  unreadFromTitle,
  urlFromArgv,
} from '../src/policy.js'

test('linearUrlToHttps maps both linear:// forms onto linear.app', () => {
  assert.equal(linearUrlToHttps('linear://linear.app/acme/issue/ENG-1'), 'https://linear.app/acme/issue/ENG-1')
  assert.equal(linearUrlToHttps('linear://acme/issue/ENG-1'), 'https://linear.app/acme/issue/ENG-1')
  assert.equal(linearUrlToHttps('linear://acme/issue/ENG-1?x=1#c'), 'https://linear.app/acme/issue/ENG-1?x=1#c')
  assert.equal(linearUrlToHttps('linear://acme'), 'https://linear.app/acme')
  assert.equal(linearUrlToHttps('linear://'), 'https://linear.app/')
  assert.equal(linearUrlToHttps('LINEAR://linear.app/x'), 'https://linear.app/x')
})

test('linearUrlToHttps never leaves linear.app', () => {
  assert.equal(linearUrlToHttps('linear://evil.com/x'), null)
  assert.equal(linearUrlToHttps('linear://user@evil/x'), 'https://linear.app/evil/x')
  assert.equal(linearUrlToHttps('linear:////evil.com/x'), 'https://linear.app/evil.com/x')
  assert.equal(new URL(linearUrlToHttps('linear://acme/../../x')).origin, 'https://linear.app')
  assert.equal(linearUrlToHttps('https://linear.app/x'), null)
  assert.equal(linearUrlToHttps('not a url'), null)
})

test('argToUrl and urlFromArgv pick the first Linear URL and skip flags', () => {
  assert.equal(argToUrl('--ozone-platform=wayland'), null)
  assert.equal(argToUrl('https://linear.app/acme'), 'https://linear.app/acme')
  assert.equal(argToUrl('https://evil.com/'), null)
  assert.equal(argToUrl('http://linear.app/'), null)
  assert.equal(argToUrl('https://uploads.linear.app/x'), null)
  assert.equal(
    urlFromArgv(['/usr/share/rectus/app.asar', '--foo', 'linear://acme/issue/A-1']),
    'https://linear.app/acme/issue/A-1',
  )
  assert.equal(urlFromArgv(['.', '--self-test']), null)
})

test('classify: Linear and Google sign-in stay in the app', () => {
  assert.equal(classify('https://linear.app/acme/inbox'), 'internal')
  assert.equal(classify('https://accounts.google.com/o/oauth2/v2/auth'), 'internal')
})

test('classify: attachments download, other Linear subdomains open in the browser', () => {
  assert.equal(classify('https://uploads.linear.app/a.png'), 'download')
  assert.equal(classify('https://status.linear.app/'), 'external')
  assert.equal(classify('https://ssl.gstatic.com/x.js'), 'external')
})

test('classify: other sites open in the browser unless in auth mode', () => {
  assert.equal(classify('https://github.com/x'), 'external')
  assert.equal(classify('http://linear.app/'), 'external')
  assert.equal(classify('https://acme.okta.com/sso'), 'external')
  assert.equal(classify('https://acme.okta.com/sso', { authMode: true }), 'internal')
  assert.equal(classify('http://acme.okta.com/sso', { authMode: true }), 'external')
  assert.equal(classify('mailto:a@b.c'), 'external')
})

test('classify: look-alike hosts are not Linear', () => {
  assert.equal(classify('https://linear.app.evil.com/'), 'external')
  assert.equal(classify('https://evillinear.app/'), 'external')
  assert.equal(classify('https://accounts.google.com.evil.com/'), 'external')
})

test('classify: dangerous schemes are denied', () => {
  for (const u of ['file:///etc/passwd', 'javascript:alert(1)', 'data:text/html,x', 'chrome://gpu', 'garbage']) {
    assert.equal(classify(u, { authMode: true }), 'deny', u)
  }
  assert.equal(classify('linear://acme/issue/A-1'), 'linear')
  assert.equal(classify('linear://evil.com/'), 'deny')
})

test('classifyPopup', () => {
  assert.equal(classifyPopup('https://linear.app/acme/issue/A-1'), 'main')
  assert.equal(classifyPopup('https://uploads.linear.app/a.pdf'), 'download')
  assert.equal(classifyPopup('https://other.linear.app/x'), 'external')
  assert.equal(classifyPopup('https://accounts.google.com/x'), 'child')
  assert.equal(classifyPopup('https://github.com/login/oauth/authorize?client_id=1'), 'child')
  assert.equal(classifyPopup('https://github.com/apps/linear/installations/new'), 'child')
  assert.equal(classifyPopup('https://github.com/attacker/repo'), 'external')
  assert.equal(classifyPopup('https://acme.slack.com/oauth/v2/authorize'), 'child')
  assert.equal(classifyPopup('https://slack.com/archives/C1'), 'external')
  assert.equal(classifyPopup('https://www.figma.com/file/abc'), 'external')
  assert.equal(classifyPopup('https://www.figma.com/oauth?client_id=1'), 'child')
  assert.equal(classifyPopup('https://evilslack.com/oauth/x'), 'external')
  assert.equal(classifyPopup('https://example.com/'), 'external')
  assert.equal(classifyPopup('mailto:a@b.c'), 'external')
  assert.equal(classifyPopup('linear://acme/x'), 'linear')
  assert.equal(classifyPopup('file:///etc/passwd'), 'deny')
  assert.equal(classifyPopup('about:blank'), 'deny')
})

test('auth pages', () => {
  assert.ok(isAuthPage('https://linear.app/login'))
  assert.ok(isAuthPage('https://linear.app/login/email'))
  assert.ok(isAuthPage('https://linear.app/auth/saml/callback'))
  assert.ok(!isAuthPage('https://linear.app/loginx'))
  assert.ok(!isAuthPage('https://linear.app/acme/inbox'))
  assert.ok(!isAuthPage('https://evil.com/login'))
  assert.ok(!isAuthPage('https://uploads.linear.app/login'))
  assert.ok(isAppPage('https://linear.app/acme/inbox'))
  assert.ok(!isAppPage('https://linear.app/login'))
  assert.ok(!isAppPage('https://evil.com/acme'))
})

test('isSafeExternal', () => {
  assert.ok(isSafeExternal('https://x.com'))
  assert.ok(isSafeExternal('mailto:a@b.c'))
  assert.ok(!isSafeExternal('file:///etc/passwd'))
  assert.ok(!isSafeExternal('smb://host/share'))
})

test('redact removes secrets', () => {
  const r = redact('https://linear.app/cb?code=abc&state=xyz&page=2#token=t')
  assert.ok(!r.includes('abc') && !r.includes('xyz') && !r.includes('token=t'))
  assert.ok(r.includes('page=2'))
  assert.equal(redact('nope'), '<invalid url>')
})

test('unreadFromTitle', () => {
  assert.equal(unreadFromTitle('(3) Inbox'), 3)
  assert.equal(unreadFromTitle('(99+) Inbox'), 99)
  assert.equal(unreadFromTitle('Inbox'), 0)
  assert.equal(unreadFromTitle(''), 0)
  assert.equal(unreadFromTitle(undefined), 0)
})

test('cleanUserAgent has no Electron token', () => {
  const ua = cleanUserAgent('140.0.7339.80')
  assert.match(ua, /Chrome\/140\.0\.0\.0 Safari\/537\.36$/)
  assert.doesNotMatch(ua, /Electron|Rectus/)
})
