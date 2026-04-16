import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const mainSource = await readFile(new URL('./main.jsx', import.meta.url), 'utf8')
const appSource = await readFile(new URL('./App.jsx', import.meta.url), 'utf8')

assert.doesNotMatch(mainSource, /getCurrentWindow\(\)\.show\(\)/)
assert.doesNotMatch(mainSource, /window\.__TAURI_INTERNALS__\?\.metadata\?\.currentWindow/)
assert.doesNotMatch(mainSource, /invoke\('reveal_main_window'\)/)
assert.match(appSource, /dismissBootSplash\(\)/)
assert.match(appSource, /invoke\('reveal_main_window'\)/)

console.log('main window reveal is deferred to App first paint stage')
