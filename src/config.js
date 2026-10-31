import { app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'

export const APP_ID = 'io.github.juthrbog.Rectus'
export const APP_NAME = 'Rectus'
export const PARTITION = 'persist:linear'

const DEFAULT_SETTINGS = {
  closeToTray: false,
  spellcheckLanguages: ['en-US'],
}

const DEFAULT_WINDOW_STATE = {
  width: 1280,
  height: 860,
  maximized: false,
}

function file(name) {
  return path.join(app.getPath('userData'), name)
}

function readJson(name, defaults) {
  try {
    const data = JSON.parse(fs.readFileSync(file(name), 'utf8'))
    if (data && typeof data === 'object' && !Array.isArray(data)) return { ...defaults, ...data }
  } catch (err) {
    if (err.code !== 'ENOENT') console.warn(`[config] cannot read ${name}: ${err.message}`)
  }
  return { ...defaults }
}

function writeJson(name, data) {
  try {
    fs.mkdirSync(app.getPath('userData'), { recursive: true })
    const target = file(name)
    const tmp = `${target}.tmp`
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2))
    fs.renameSync(tmp, target)
  } catch (err) {
    console.warn(`[config] cannot write ${name}: ${err.message}`)
  }
}

let settings = null

export function getSettings() {
  settings ??= readJson('settings.json', DEFAULT_SETTINGS)
  return settings
}

export function updateSettings(patch) {
  settings = { ...getSettings(), ...patch }
  writeJson('settings.json', settings)
  return settings
}

export function loadWindowState() {
  const s = readJson('window-state.json', DEFAULT_WINDOW_STATE)
  const okSize = (n, min) => Number.isInteger(n) && n >= min && n <= 10000
  return {
    width: okSize(s.width, 400) ? s.width : DEFAULT_WINDOW_STATE.width,
    height: okSize(s.height, 300) ? s.height : DEFAULT_WINDOW_STATE.height,
    maximized: s.maximized === true,
  }
}

export function saveWindowState(state) {
  writeJson('window-state.json', state)
}
