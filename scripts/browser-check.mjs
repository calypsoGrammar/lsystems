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

  // Auto fit (CAL-1273), driven through the real DOM at mobile (DPR 2) and desktop (DPR 1) sizes.
  const BBOX = () => { const c = document.getElementById('fCanvas'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1; for (let i = 3; i < d.length; i += 4) if (d[i]) { const p = (i - 3) / 4, x = p % c.width, y = Math.floor(p / c.width); if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y } return { x0, x1, y0, y1, w: c.width, h: c.height, cssW: parseFloat(c.style.width), cssH: parseFloat(c.style.height) } }
  const SET = ([id, v]) => { const e = document.getElementById(id); if (e.type === 'checkbox') e.checked = v; else e.value = v; e.dispatchEvent(new Event('change')) }
  for (const [label, vw, vh, dpr] of [['mobile', 375, 667, 2], ['desktop', 1280, 800, 1]]) {
    const ctx2 = await browser.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: dpr })
    const mp = await ctx2.newPage()
    const mErrors = []
    mp.on('pageerror', e => mErrors.push(e.message))
    await mp.goto(URL_)
    await mp.waitForFunction(() => document.querySelectorAll('#fSettingsPresets option').length > 0)
    await mp.click('#HideButton'); await mp.waitForSelector('#fSettings', { state: 'visible' })
    const set = (id, v) => mp.evaluate(SET, [id, v])
    const gen = async () => { await mp.click('#GenerateButton'); await mp.waitForTimeout(250); return mp.evaluate(BBOX) }
    const pick = async name => { await mp.evaluate(n => { const e = document.getElementById('fSettingsPresets'); e.value = [...e.options].find(o => o.text === n).value; e.dispatchEvent(new Event('change')) }, name); await mp.waitForTimeout(250); return mp.evaluate(BBOX) }
    const inside = (tag, r, scale) => {
      const pad = Math.max(8, Math.min(r.cssW, r.cssH) * 0.05) * scale
      check(r.x1 >= 0, `${label} ${tag}: blank canvas`)
      check(r.x0 >= pad - 2 * scale && r.y0 >= pad - 2 * scale && r.x1 <= r.w - pad + 2 * scale && r.y1 <= r.h - pad + 2 * scale, `${label} ${tag}: drawing outside the padding (${r.x0},${r.y0},${r.x1},${r.y1} on ${r.w}x${r.h})`)
      check(Math.abs((r.x0 + r.x1) / 2 - r.w / 2) < 6 * scale && Math.abs((r.y0 + r.y1) / 2 - r.h / 2) < 6 * scale, `${label} ${tag}: drawing not centred`)
    }
    await set('fSettingsAnimate', false)
    check((await mp.evaluate(BBOX)).w === Math.round(vw * dpr), `${label}: backing store is not CSS width x DPR`)

    for (const name of ['Koch Island', 'Hilbert Curve', 'Fractal Plant 2', 'Pentigree Curve', 'Star']) inside(name, await pick(name), dpr)

    // CAL-1277: every preset (incl. stochastic Fractal Plant 8 and context-sensitive Fractal Plant 9) draws a non-blank, fitted, centred scene.
    const allNames = await mp.evaluate(() => [...document.getElementById('fSettingsPresets').options].map(o => o.text))
    check(allNames.length === 29, `${label}: expected 29 presets, saw ${allNames.length}`)
    for (const name of allNames) inside('preset ' + name, await pick(name), dpr)

    // Long/thin: a straight horizontal line from a typed axiom.
    await pick('Koch Island')
    await set('fSettingsAxiom', '+' + 'F'.repeat(30)); await set('fSettingsIterations', '0')
    inside('long/thin axiom', await gen(), dpr)

    // Forest of five trees fitted as one scene.
    await pick('Fractal Plant 2')
    await set('fSettingsForest', true); await set('fSettingsCount', '5')
    inside('forest', await gen(), dpr)
    await set('fSettingsForest', false)

    // Manual Scale / Length / factor are honoured with auto fit off; Fit to View and Reset View restore the fit.
    await pick('Koch Island')
    await set('fSettingsFit', false); await set('fSettingsLength', '40')
    await set('fSettingsCanvas', '1'); const s1 = await gen()
    await set('fSettingsCanvas', '2'); const s2 = await gen()
    const wd = r => r.x1 - r.x0, ratio = wd(s2) / wd(s1)
    check(ratio > 1.8 && ratio < 2.2, `${label}: Scale 1 -> 2 changed drawn width by ${ratio.toFixed(2)}, expected about 2`)
    inside('manual scale 2', s2, dpr)
    await set('fSettingsCanvas', '1'); await set('fSettingsLength', '80'); const l2 = await gen()
    check(wd(l2) / wd(s1) > 1.8, `${label}: doubling Starting Length did not enlarge the drawing`)
    await set('fSettingsLength', '40'); await set('fSettingsFactor', '2'); const f2 = await gen()
    check(wd(f2) > wd(s1) * 1.5, `${label}: factor 4 -> 2 did not enlarge the drawing`)
    check(await mp.evaluate(() => document.getElementById('fSettingsFactor').value) === '2', `${label}: factor field changed`)
    await set('fSettingsFactor', '4')
    await mp.click('#fSettingsFitNow'); await mp.waitForTimeout(250)
    check(await mp.evaluate(() => document.getElementById('fSettingsFit').checked), `${label}: Fit to View did not enable auto fit`)
    inside('Fit to View', await mp.evaluate(BBOX), dpr)
    await set('fSettingsFit', false); await set('fSettingsCanvas', '3'); await set('fSettingsLength', '33')
    await mp.click('#fSettingsResetView'); await mp.waitForTimeout(250)
    const reset = await mp.evaluate(() => ['fSettingsLength', 'fSettingsCanvas'].map(i => document.getElementById(i).value).concat(String(document.getElementById('fSettingsFit').checked)))
    check(reset.join() === '250,1,true', `${label}: Reset View gave ${reset.join()}, expected 250,1,true`)
    inside('Reset View', await mp.evaluate(BBOX), dpr)

    // Resize re-fits the same scene at the new size (see the CAL-1275 section below): backing store follows CSS size x DPR and the fit is kept.
    const [nw, nh] = label === 'mobile' ? [667, 375] : [600, 900]
    await mp.setViewportSize({ width: nw, height: nh }); await mp.waitForTimeout(400)
    const rs = await mp.evaluate(BBOX)
    check(rs.w === Math.round(nw * dpr) && rs.cssW === nw, `${label}: after resize backing width ${rs.w}, css ${rs.cssW}`)
    inside('after resize', rs, dpr)

    check(mErrors.length === 0, `${label} page errors: ` + mErrors.join('; '))
    await ctx2.close()
  }

  // CAL-1275: resize re-fits the existing scene, forest animation draws every tree, repeated Generate leaves no stale drawing.
  {
    const ctx3 = await browser.newContext({ viewport: { width: 1000, height: 700 } })
    const p3 = await ctx3.newPage()
    const e3 = []
    p3.on('pageerror', e => e3.push(e.message))
    await p3.goto(URL_)
    await p3.waitForFunction(() => document.querySelectorAll('#fSettingsPresets option').length > 0)
    await p3.click('#HideButton'); await p3.waitForSelector('#fSettings', { state: 'visible' })
    const set = (id, v) => p3.evaluate(SET, [id, v])
    const pick = name => p3.evaluate(n => { const e = document.getElementById('fSettingsPresets'); e.value = [...e.options].find(o => o.text === n).value; e.dispatchEvent(new Event('change')) }, name)
    const HASH = () => { const c = document.getElementById('fCanvas'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let h = 0, n = 0; for (let i = 0; i < d.length; i += 4) if (d[i + 3]) { n++; h = (h * 31 + d[i] * 7 + d[i + 1] * 13 + d[i + 2] * 17 + d[i + 3] + i) | 0 } return { h, n } }
    const text = () => p3.evaluate(() => document.getElementById('oView').textContent)
    const hash = () => p3.evaluate(HASH)
    // Resize away and back (each waits past the 120 ms debounce): the redraw is of the same scene at the same size.
    const bounce = async () => { await p3.setViewportSize({ width: 600, height: 900 }); await p3.waitForTimeout(400); const mid = await p3.evaluate(BBOX); await p3.setViewportSize({ width: 1000, height: 700 }); await p3.waitForTimeout(400); return mid }
    const settle = async tag => { // wait until the pixel count stops changing for 1.5 s
      let last = -1, stable = 0
      for (let i = 0; i < 120 && stable < 6; i++) { await p3.waitForTimeout(250); const { n } = await hash(); stable = n === last ? stable + 1 : 0; last = n }
      check(stable >= 6, tag + ': animation did not finish')
    }

    // Stochastic grammar, static: resize must not change the output text or the picture.
    await set('fSettingsAnimate', false)
    await pick('Fractal Plant 8'); await set('fSettingsIterations', '4')
    for (const forest of [false, true]) {
      await set('fSettingsForest', forest); await set('fSettingsCount', '5')
      await p3.click('#GenerateButton'); await p3.waitForTimeout(500)
      const t0 = await text(), h0 = await hash(), b0 = await p3.evaluate(BBOX)
      const mid = await bounce()
      check(await text() === t0, `resize changed the output text (forest ${forest})`)
      const h1 = await hash()
      check(h1.h === h0.h && h1.n === h0.n, `redraw at the original size differs from the first draw (forest ${forest})`)
      const aspect = r => (r.x1 - r.x0) / (r.y1 - r.y0)
      if (!forest) check(Math.abs(aspect(mid) - aspect(b0)) / aspect(b0) < 0.03, `aspect ratio changed on resize: ${aspect(b0)} -> ${aspect(mid)}`)
      else check(mid.x0 >= 0 && mid.x1 < mid.w && mid.y1 < mid.h, 'forest clipped after resize')
    }

    // Animated forest: every tree gets drawn; the finished picture equals the static redraw.
    await set('fSettingsAnimate', true); await set('fSettingsInterval', '10')
    await pick('Fractal Plant 2'); await set('fSettingsIterations', '2'); await set('fSettingsForest', true); await set('fSettingsCount', '3')
    await p3.click('#GenerateButton')
    await settle('animated forest')
    const ha = await hash(), ba = await p3.evaluate(BBOX)
    await bounce()
    const hs = await hash(), bs = await p3.evaluate(BBOX)
    check(ha.h === hs.h && ha.n === hs.n && ba.x0 === bs.x0 && ba.x1 === bs.x1, `animated forest differs from its static redraw (${ha.n} vs ${hs.n} px): trees missing or stale`)

    // Repeated Generate while animating, then a resize mid-animation: the end state is one complete scene.
    for (let i = 0; i < 4; i++) { await p3.click('#GenerateButton'); await p3.waitForTimeout(80) }
    await p3.setViewportSize({ width: 800, height: 700 }); await p3.waitForTimeout(300)
    await p3.setViewportSize({ width: 1000, height: 700 }); await p3.waitForTimeout(300)
    await settle('rapid Generate')
    const hr = await hash()
    await bounce()
    const hr2 = await hash()
    check(hr.h === hr2.h && hr.n === hr2.n, `drawing after repeated Generate/resize is not one clean scene (${hr.n} vs ${hr2.n} px)`)
    check(e3.length === 0, 'CAL-1275 page errors: ' + e3.join('; '))
    await ctx3.close()
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

  // Rule editor (CAL-1274): edits survive structural changes, markup is inert, invalid input is shown inline, drafts and reset.
  {
    await page.click('#HideButton')
    await page.waitForSelector('#fSettings', { state: 'visible' })
    const pick = async name => { await page.evaluate(n => { const e = document.getElementById('fSettingsPresets'); e.value = [...e.options].find(o => o.text === n).value; e.dispatchEvent(new Event('change')) }, name); await page.waitForTimeout(200) }
    const val = id => page.inputValue('#' + id)
    check(await page.locator('[onclick]').count() === 0, 'inline onclick attributes remain in the page')
    await pick('Dragon Curve')
    await page.fill('#fSettingsAxiom', 'FX+')
    await page.fill('#fSettingsTheta', '33')
    await page.fill('#predecessor0', 'X')
    await page.fill('#successor00', '<img src=x onerror="window.__x=1">&amp;')
    await page.fill('#successor10', 'unsaved-in-rule-2')
    await page.click('#add0')
    check(await page.locator('#successor01').count() === 1, 'Add Successor did not add a row')
    check(await val('successor00') === '<img src=x onerror="window.__x=1">&amp;', 'successor text changed when adding a successor')
    check(await val('successor10') === 'unsaved-in-rule-2' && await val('fSettingsAxiom') === 'FX+' && await val('fSettingsTheta') === '33', 'unrelated edits lost on Add Successor')
    check(await val('weight01') === '0', `new successor weight ${await val('weight01')}, expected 0`)
    await page.click('#fSettingsReplacementAdd')
    check(await page.locator('#predecessor2').count() === 1, 'Add Rule did not add a rule')
    await page.fill('#predecessor2', 'Q')
    await page.click('#removeRule1')
    check(await page.locator('#predecessor2').count() === 0 && await val('predecessor1') === 'Q', 'Remove Rule removed the wrong rule')
    check(await val('successor00') === '<img src=x onerror="window.__x=1">&amp;' && await val('fSettingsAxiom') === 'FX+', 'edits lost on Remove Rule')
    await page.click('#removeSuccessor01')
    check(await page.locator('#successor01').count() === 0 && await val('predecessor0') === 'X', 'Remove Successor failed or lost edits')
    check(await page.locator('#fSettings img').count() === 0 && await page.evaluate(() => window.__x === undefined), 'editable text was interpreted as HTML')
    check(/modified|Edited/i.test(await page.textContent('#fSettingsStatus')), 'status does not show unsaved edits')

    // Generate uses exactly the displayed values (rule 2 has predecessor Q and one empty successor: valid).
    await page.fill('#fSettingsIterations', '0')
    await page.click('#GenerateButton'); await page.waitForTimeout(200)
    check(!(await page.locator('#fError').isVisible()), '#fError shown for a valid custom grammar: ' + await page.textContent('#fError'))
    await page.click('#OutputButton'); await page.waitForTimeout(100)
    check((await page.textContent('#oView')).startsWith('FX+'), 'output does not start with the displayed axiom')
    await page.click('#HideButton'); await page.waitForSelector('#fSettings', { state: 'visible' })

    // Invalid input is flagged inline, accessibly, and the typed text is untouched.
    const shot = await px()
    await page.fill('#weight00', 'abc')
    await page.click('#GenerateButton'); await page.waitForTimeout(200)
    check(await page.getAttribute('#weight00', 'aria-invalid') === 'true', 'invalid weight not aria-invalid')
    const descId = await page.getAttribute('#weight00', 'aria-describedby')
    check(!!descId && await page.locator('#' + descId).isVisible(), 'invalid weight has no visible description')
    check(await val('weight00') === 'abc', 'invalid weight text was changed')
    check(await page.locator('#fError').isVisible(), 'error banner not shown for invalid weight')
    check(await px() === shot, 'canvas changed after invalid weight')
    await page.fill('#predecessor0', '')
    await page.fill('#weight00', '1')
    check(await page.getAttribute('#weight00', 'aria-invalid') === null, 'corrected weight still flagged')
    check(await page.getAttribute('#predecessor0', 'aria-invalid') === 'true', 'empty predecessor not flagged')
    await page.fill('#predecessor0', 'X')
    await page.fill('#fSettingsTheta', '999')
    await page.click('#GenerateButton')
    check(await page.getAttribute('#fSettingsTheta', 'aria-invalid') === 'true', 'out of range theta not flagged')
    await page.fill('#fSettingsTheta', '33')

    // Count / Interval / Variance / Length are validated, shown inline, and corrections clear the error.
    {
      await page.evaluate(() => { const e = document.getElementById('fSettingsForest'); e.checked = true; e.dispatchEvent(new Event('change')) })
      await page.fill('#fSettingsCount', '5'); await page.click('#GenerateButton'); await page.waitForTimeout(300)
      const ok = await px()
      for (const bad of ['', '30', '2.5']) {
        await page.fill('#fSettingsCount', bad)
        await page.click('#GenerateButton'); await page.waitForTimeout(200)
        check(await page.getAttribute('#fSettingsCount', 'aria-invalid') === 'true', `Count "${bad}" not flagged`)
        check(await page.locator('#fError').isVisible(), `Count "${bad}": no error banner`)
        check(await px() === ok, `canvas changed after invalid Count "${bad}"`)
      }
      await page.fill('#fSettingsCount', '3')
      check(await page.getAttribute('#fSettingsCount', 'aria-invalid') === null, 'corrected Count still flagged')
      await page.evaluate(() => { const e = document.getElementById('fSettingsForest'); e.checked = false; e.dispatchEvent(new Event('change')) })
      await page.evaluate(() => { const e = document.getElementById('fSettingsAnimate'); e.checked = true; e.dispatchEvent(new Event('change')) })
      await page.fill('#fSettingsInterval', '5'); await page.click('#GenerateButton')
      check(await page.getAttribute('#fSettingsInterval', 'aria-invalid') === 'true', 'Interval 5 not flagged')
      await page.fill('#fSettingsInterval', '10')
      await page.evaluate(() => { const e = document.getElementById('fSettingsAnimate'); e.checked = false; e.dispatchEvent(new Event('change')) })
      await page.fill('#fSettingsVariance', '300'); await page.click('#GenerateButton')
      check(await page.getAttribute('#fSettingsVariance', 'aria-invalid') === 'true', 'Variance 300 not flagged')
      await page.fill('#fSettingsVariance', '5')
      await page.evaluate(() => { const e = document.getElementById('fSettingsFit'); e.checked = false; e.dispatchEvent(new Event('change')) })
      await page.fill('#fSettingsLength', ''); await page.click('#GenerateButton')
      check(await page.getAttribute('#fSettingsLength', 'aria-invalid') === 'true', 'empty Starting Length not flagged')
      await page.fill('#fSettingsLength', '100')
      check(await page.getAttribute('#fSettingsLength', 'aria-invalid') === null, 'corrected Starting Length still flagged')
      await page.evaluate(() => { const e = document.getElementById('fSettingsFit'); e.checked = true; e.dispatchEvent(new Event('change')) })
    }

    // Switching presets loads the template; Reset to preset restores the original template.
    await page.fill('#fSettingsAxiom', 'FX+')
    await pick('Koch Island')
    check(/discarded/.test(await page.textContent('#fSettingsStatus')), 'discarding edits on preset switch is not announced')
    check(await val('fSettingsAxiom') === 'F-F-F-F', 'Koch Island axiom not loaded')
    check(/original/i.test(await page.textContent('#fSettingsStatus')), 'status should say original preset')
    await pick('Dragon Curve')
    check(await val('fSettingsAxiom') === 'FX' && await val('fSettingsTheta') === '90', 'returning to a preset did not load its template')
    await page.fill('#fSettingsAxiom', 'FXX'); await page.fill('#fSettingsTheta', '12'); await page.click('#fSettingsReplacementAdd')
    await page.click('#fSettingsReset'); await page.waitForTimeout(200)
    check(await val('fSettingsAxiom') === 'FX' && await val('fSettingsTheta') === '90' && await page.locator('#predecessor2').count() === 0, 'Reset to preset did not restore the template')
    check(/Original/.test(await page.textContent('#fSettingsStatus')), 'status not original after reset')
    await page.click('#HideButton')
  }

  // Accessibility and small landscape (CAL-1276): named icon buttons, touch-sized toolbar, panels inside the viewport,
  // reduced motion switches the animation off, and long generations are shown in sections without losing symbols.
  {
    const actx = await browser.newContext({ viewport: { width: 667, height: 375 }, reducedMotion: 'reduce' })
    const ap = await actx.newPage()
    const aErrors = []
    ap.on('pageerror', e => aErrors.push(e.message))
    await ap.goto(URL_)
    await ap.waitForFunction(() => document.querySelectorAll('#fSettingsPresets option').length > 0)
    const names = await ap.evaluate(() => [...document.querySelectorAll('#toolbar button')].map(b => ({ n: b.getAttribute('aria-label') || b.textContent.trim(), h: b.getBoundingClientRect().height, w: b.getBoundingClientRect().width })))
    check(names.length === 5 && names.every(b => b.n && b.h >= 44 && b.w >= 44), 'toolbar buttons need names and 44px targets: ' + JSON.stringify(names))
    check(await ap.isChecked('#fSettingsAnimate') === false, 'reduced motion should start with Animate off')
    await ap.click('#HideButton')
    check(await ap.getAttribute('#HideButton', 'aria-pressed') === 'true', 'selected toolbar button not exposed via aria-pressed')
    const box = await ap.evaluate(() => { const r = document.getElementById('fSettings').getBoundingClientRect(); return { bottom: r.bottom, vh: innerHeight, top: r.top, tb: document.getElementById('toolbar').getBoundingClientRect().bottom } })
    check(box.bottom <= box.vh + 1 && box.top >= box.tb - 1, 'landscape: settings panel clipped by the viewport ' + JSON.stringify(box))
    await ap.keyboard.press('Escape')
    check(await ap.isVisible('#fCanvas'), 'Escape should return to the drawing')
    const cv = await ap.evaluate(() => ({ h: parseFloat(document.getElementById('fCanvas').style.height), tb: document.getElementById('toolbar').offsetHeight, vh: innerHeight }))
    check(Math.abs(cv.h + cv.tb - cv.vh) <= 1, 'canvas should fill the space below the toolbar ' + JSON.stringify(cv))
    await ap.click('#FitButton')
    await ap.click('#OutputButton')
    check((await ap.locator('#oView [role=group]').count()) >= 2, 'output groups missing')
    check(aErrors.length === 0, 'accessibility page errors: ' + aErrors.join('; '))
    await actx.close()
  }

  // Page load animates (startup sizing must not cancel it), and a rejected draw never leaves the busy state stuck.
  {
    const lctx = await browser.newContext({ viewport: { width: 1000, height: 700 } })
    const lp = await lctx.newPage()
    await lp.goto(URL_)
    await lp.waitForFunction(() => document.querySelectorAll('#fSettingsPresets option').length > 0)
    await lp.waitForTimeout(250)
    const n1 = await lp.evaluate(() => { const c = document.getElementById('fCanvas'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i]) n++; return n })
    await lp.waitForTimeout(150)
    const n2 = await lp.evaluate(() => { const c = document.getElementById('fCanvas'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i]) n++; return n })
    check(n2 > n1 || await lp.getAttribute('#GenerateButton', 'aria-busy') === 'true', `page load did not animate (${n1} -> ${n2} px)`)
    await lp.waitForTimeout(8000)
    check(await lp.getAttribute('#GenerateButton', 'aria-busy') === 'false', 'busy state stuck after the animation finished')
    await lp.click('#HideButton')
    await lp.fill('#fSettingsInterval', '1000'); await lp.click('#GenerateButton')
    await lp.fill('#fSettingsIterations', '10'); await lp.fill('#fSettingsAxiom', 'FFFFFFF'); await lp.fill('#predecessor0', 'F'); await lp.fill('#successor00', 'FFF')
    await lp.click('#GenerateButton'); await lp.waitForTimeout(1500)
    check(await lp.getAttribute('#GenerateButton', 'aria-busy') === 'false', 'busy state stuck after a rejected draw: ' + await lp.textContent('#fError'))
    await lctx.close()
  }

  // Narrow screen: no horizontal overflow in the editor and touch-sized buttons.
  {
    const nctx = await browser.newContext({ viewport: { width: 320, height: 640 } })
    const np = await nctx.newPage()
    const nErrors = []
    np.on('pageerror', e => nErrors.push(e.message))
    await np.goto(URL_)
    await np.waitForFunction(() => document.querySelectorAll('#fSettingsPresets option').length > 0)
    await np.click('#HideButton'); await np.waitForSelector('#fSettings', { state: 'visible' })
    await np.click('#add0'); await np.click('#fSettingsReplacementAdd')
    const m = await np.evaluate(() => { const f = document.getElementById('fSettings'); const small = [...f.querySelectorAll('button')].filter(b => b.getBoundingClientRect().height < 36).length; const wide = [...f.querySelectorAll('input,textarea,select,button')].filter(e => e.getBoundingClientRect().right > f.clientWidth + 1).length; return { over: f.scrollWidth - f.clientWidth, small, wide, sections: [...f.querySelectorAll('section h2')].map(h => h.textContent) } })
    check(m.over <= 1 && m.wide === 0, `narrow: editor overflows horizontally (${m.over}px, ${m.wide} controls)`)
    check(m.small === 0, `narrow: ${m.small} buttons shorter than 36px`)
    check(m.sections.join() === 'Grammar,Appearance,Rendering', 'editor sections: ' + m.sections.join())
    check(nErrors.length === 0, 'narrow page errors: ' + nErrors.join('; '))
    await nctx.close()
  }

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
