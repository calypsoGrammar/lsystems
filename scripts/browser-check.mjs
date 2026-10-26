// Browser regression check for the built app (CAL-1270). Serves dist/ with `vite preview` and asserts:
// 29 presets, non-blank canvas, rule-editor controls, no page errors, no off-origin requests, key computed styles.
// Needs a prior `npm run build`. Env: PLAYWRIGHT_BROWSERS_PATH (default /usr/local/share/ms-playwright),
// PLAYWRIGHT_MODULE (default /usr/local/lib/node_modules/playwright/index.mjs).
import { spawn } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/usr/local/share/ms-playwright'
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? '/usr/local/lib/node_modules/playwright/index.mjs')
const root = fileURLToPath(new URL('..', import.meta.url))
const PORT = 4174, URL_ = `http://127.0.0.1:${PORT}/`
const failures = []
const check = (ok, msg) => { if (!ok) failures.push(msg) }

// Static: every normalize/preflight rule must be inside a cascade layer, or it beats Tailwind utilities.
const cssFile = readdirSync(root + 'dist/assets').find(f => f.endsWith('.css'))
const css = readFileSync(root + 'dist/assets/' + cssFile, 'utf8')
const topLevel = []
for (let depth = 0, start = 0, i = 0; i < css.length; i++) {
  if (css[i] === '/' && css[i + 1] === '*') { i = css.indexOf('*/', i) + 1; start = i + 1; continue }
  if (css[i] === '{') { if (depth++ === 0) topLevel.push(css.slice(start, i).trim()) }
  else if (css[i] === '}') { if (--depth === 0) start = i + 1 }
  else if (css[i] === ';' && depth === 0) start = i + 1
}
const unlayered = topLevel.filter(h => !/^@(layer|supports|media|property|keyframes|font-face)/.test(h))
check(unlayered.length === 0, 'unlayered style rules in built CSS: ' + unlayered.slice(0, 3).join(' | '))

const preview = spawn('npx', ['vite', 'preview', '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'], { cwd: root, stdio: 'ignore' })
let browser
try {
  for (let i = 0; i < 50; i++) { try { if ((await fetch(URL_)).ok) break } catch {} await new Promise(r => setTimeout(r, 200)) }
  browser = await chromium.launch()
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage()
  const errors = [], external = []
  page.on('pageerror', e => errors.push(e.message))
  page.on('response', r => { if (r.status() >= 400) errors.push(r.status() + ' ' + r.url()) })
  await page.route(u => !u.href.startsWith(URL_), r => { external.push(r.request().url()); r.abort() })
  await page.goto(URL_)
  const appLoaded = await page.waitForFunction(() => document.querySelectorAll('#fSettingsPresets option').length > 0, null, { timeout: 15000 }).then(() => true, () => false)
  if (!appLoaded) {
    console.error('app did not populate the preset list; page errors: ' + (errors.join('; ') || 'none') + '; off-origin requests: ' + (external.join(', ') || 'none') + '; page html: ' + (await page.content()).slice(0, 600))
    process.exitCode = 1
    throw new Error('app did not load')
  }
  const presets = await page.evaluate(() => document.querySelectorAll('#fSettingsPresets option').length)
  check(presets === 29, `expected 29 presets, saw ${presets}`)

  const px = () => page.evaluate(() => { const c = document.getElementById('fCanvas'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i]) n++; return n })
  await page.evaluate(() => { const e = document.getElementById('fSettingsAnimate'); e.checked = false; e.dispatchEvent(new Event('change')) })
  await page.click('#GenerateButton')
  await page.waitForTimeout(300)
  check(await px() > 0, 'canvas blank after Generate')

  const style = (sel, props) => page.evaluate(([sel, props]) => { const s = getComputedStyle(document.querySelector(sel)); return Object.fromEntries(props.map(p => [p, s[p]])) }, [sel, props])
  const hdr = await style('#GenerateButton', ['marginLeft', 'marginRight'])
  check(hdr.marginLeft === '16px' && hdr.marginRight === '16px', `header button margin ${hdr.marginLeft}/${hdr.marginRight}, expected 16px`)
  await page.click('#HideButton') // opens the settings panel
  await page.waitForSelector('#fSettings', { state: 'visible' })
  const sel = await style('#fSettingsPresets', ['marginTop', 'marginLeft'])
  check(sel.marginTop === '8px' && sel.marginLeft === '8px', `preset select margin ${sel.marginTop}/${sel.marginLeft}, expected 8px`)
  check((await style('body', ['lineHeight'])).lineHeight !== '18.4px', 'body line-height is normalize 1.15, not Tailwind')

  for (const id of ['predecessor0', 'successor00', 'weight00', 'add0', 'removeRule0', 'removeSuccessor00']) {
    check(await page.locator('#' + id).count() === 1, `rule editor control #${id} missing`)
  }
  const m = await style('#predecessor0', ['marginTop'])
  check(m.marginTop === '8px', `rule textarea margin ${m.marginTop}, expected 8px`)
  const b = await style('#add0', ['color', 'backgroundColor'])
  check(b.color !== b.backgroundColor, `#add0 text and background are both ${b.color}`)

  check(errors.length === 0, 'page errors: ' + errors.join('; '))
  check(external.length === 0, 'off-origin requests: ' + external.join(', '))
} finally {
  await browser?.close()
  preview.kill()
}
if (failures.length) { console.error('browser check FAILED:\n- ' + failures.join('\n- ')); process.exit(1) }
console.log('browser check passed')
