// Browser regression check for the built app (CAL-1270). Serves dist/ with `vite preview` and asserts:
// 29 presets, non-blank canvas, rule-editor controls, no page errors, no off-origin requests, key computed styles.
// Rebuilds dist/ first (about 1 s) so it never serves a stale or missing bundle. Env: PLAYWRIGHT_BROWSERS_PATH (default /usr/local/share/ms-playwright),
// PLAYWRIGHT_MODULE (default /usr/local/lib/node_modules/playwright/index.mjs).
import { spawn, spawnSync } from 'node:child_process'
import { createServer } from 'node:net'
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/usr/local/share/ms-playwright'
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? '/usr/local/lib/node_modules/playwright/index.mjs')
const root = fileURLToPath(new URL('..', import.meta.url))
// A free port per run, so an orphaned server from an earlier run (it would serve a stale file listing) is never reused.
const PORT = await new Promise(res => { const s = createServer().listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => res(port)) }) })
const URL_ = `http://127.0.0.1:${PORT}/`
const failures = []
const check = (ok, msg) => { if (!ok) failures.push(msg) }

const build = spawnSync('npx', ['vite', 'build'], { cwd: root, stdio: 'inherit' })
if (build.status !== 0) { console.error('vite build failed'); process.exit(1) }

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

const preview = spawn(process.execPath, [root + 'node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'], { cwd: root, stdio: 'ignore' })
let browser
try {
  for (let i = 0; i < 50; i++) { try { if ((await fetch(URL_)).ok) break } catch {} await new Promise(r => setTimeout(r, 200)) }
  browser = await chromium.launch()
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage()
  const errors = [], external = []
  page.on('pageerror', e => errors.push(e.message))
  await page.route(u => !u.href.startsWith(URL_), r => { external.push(r.request().url()); r.abort() })
  await page.goto(URL_)
  await page.waitForFunction(() => document.querySelectorAll('#fSettingsPresets option').length > 0)
  const presets = await page.evaluate(() => document.querySelectorAll('#fSettingsPresets option').length)
  check(presets === 29, `expected 29 presets, saw ${presets}`)

  const px = () => page.evaluate(() => { const c = document.getElementById('fCanvas'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i]) n++; return n })
  await page.evaluate(() => { const e = document.getElementById('fSettingsAnimate'); e.checked = false; e.dispatchEvent(new Event('change')) })
  await page.click('#GenerateButton')
  await page.waitForTimeout(300)
  check(await px() > 0, 'canvas blank after Generate')

  // Centring: the first preset drawn statically should sit around the canvas centre, and again after a second Generate
  // (bounds must not carry over between runs).
  const bbox = () => page.evaluate(() => { const c = document.getElementById('fCanvas'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1; for (let i = 3; i < d.length; i += 4) if (d[i]) { const p = (i - 3) / 4, x = p % c.width, y = Math.floor(p / c.width); if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y } return { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, w: c.width, h: c.height } })
  const first = await bbox()
  check(Math.abs(first.cx - first.w / 2) < 40 && Math.abs(first.cy - first.h / 2) < 40, `drawing not centred: centre ${first.cx},${first.cy} on ${first.w}x${first.h}`)
  await page.click('#GenerateButton')
  await page.waitForTimeout(300)
  const second = await bbox()
  check(Math.abs(second.cx - first.cx) < 2 && Math.abs(second.cy - first.cy) < 2, `drawing moved on second Generate: ${first.cx},${first.cy} -> ${second.cx},${second.cy}`)

  // Auto fit (CAL-1273): a mobile viewport at devicePixelRatio 2 gets a hi-dpi backing store, and the drawing sits inside
  // the canvas, centred, with padding, for the first three presets (including the default).
  {
    const ctx2 = await browser.newContext({ viewport: { width: 375, height: 667 }, deviceScaleFactor: 2 })
    const mp = await ctx2.newPage()
    const mErrors = []
    mp.on('pageerror', e => mErrors.push(e.message))
    await mp.goto(URL_)
    await mp.waitForFunction(() => document.querySelectorAll('#fSettingsPresets option').length > 0)
    await mp.evaluate(() => { const e = document.getElementById('fSettingsAnimate'); e.checked = false })
    for (const idx of [0, 1, 2, 28]) {
      await mp.evaluate(i => { const e = document.getElementById('fSettingsPresets'); e.value = String(i); e.dispatchEvent(new Event('change')) }, idx)
      await mp.waitForTimeout(300)
      const r = await mp.evaluate(() => { const c = document.getElementById('fCanvas'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1; for (let i = 3; i < d.length; i += 4) if (d[i]) { const p = (i - 3) / 4, x = p % c.width, y = Math.floor(p / c.width); if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y } return { x0, x1, y0, y1, w: c.width, h: c.height, cssW: parseFloat(c.style.width) } })
      check(r.w === Math.round(r.cssW * 2), `preset ${idx}: canvas backing width ${r.w} is not 2x CSS width ${r.cssW}`)
      check(r.x1 >= 0 && r.x0 > 2 && r.x1 < r.w - 2 && r.y0 > 2 && r.y1 < r.h - 2, `preset ${idx}: drawing touches or leaves the canvas edge`)
      check(Math.abs((r.x0 + r.x1) / 2 - r.w / 2) < 6 && Math.abs((r.y0 + r.y1) / 2 - r.h / 2) < 6, `preset ${idx}: drawing not centred on mobile`)
    }
    check(mErrors.length === 0, 'mobile page errors: ' + mErrors.join('; '))
    await ctx2.close()
  }

  // Rejected grammar: previous drawing stays, the error banner shows, and a valid run hides it again.
  await page.click('#HideButton')
  await page.waitForSelector('#fSettings', { state: 'visible' })
  const before = await px()
  await page.fill('#fSettingsIterations', '26')
  await page.click('#GenerateButton')
  await page.waitForTimeout(300)
  check(await page.locator('#fError').isVisible(), '#fError not shown for 26 iterations')
  check((await page.locator('#fError').textContent()).length > 0, '#fError is empty')
  check(await px() === before, 'canvas changed after a rejected grammar')
  await page.fill('#fSettingsIterations', '2')
  await page.click('#GenerateButton')
  await page.waitForTimeout(300)
  check(!(await page.locator('#fError').isVisible()), '#fError still visible after a valid run')
  await page.click('#HideButton') // close the settings panel again

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
