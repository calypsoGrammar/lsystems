// Headless-browser baseline for CAL-1269: serves dist/ with `vite preview`, drives the built app and records
// non-transparent canvas pixels per preset / viewport / animation setting, plus browser-confirmed defects.
// Needs a prior `npm run build`. Usage: node scripts/browser-baseline.mjs   (writes docs/browser-baseline.json)
// Env: PLAYWRIGHT_BROWSERS_PATH=/usr/local/share/ms-playwright, PLAYWRIGHT_MODULE=<path to playwright/index.mjs>
import { spawn } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/usr/local/share/ms-playwright'
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? '/usr/local/lib/node_modules/playwright/index.mjs')
const root = fileURLToPath(new URL('..', import.meta.url))
const PORT = 4173, URL_ = `http://127.0.0.1:${PORT}/`

const preview = spawn('npx', ['vite', 'preview', '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] })
let previewLog = ''; preview.stdout.on('data', d => previewLog += d); preview.stderr.on('data', d => previewLog += d)
for (let i = 0; i < 50; i++) { try { if ((await fetch(URL_)).ok) break } catch {} await new Promise(r => setTimeout(r, 200)) }

const failures = []
const out = { previewServed: false, externalRequests: [], viewports: {}, presets: [], defects: {} }
const browser = await chromium.launch()
const seeded = `(() => { let s = 12345; Math.random = () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296 } })()`

async function open(viewport) {
  const ctx = await browser.newContext({ viewport })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', e => errors.push(e.name + ': ' + e.message))
  await page.route(u => !u.href.startsWith(URL_), r => { out.externalRequests.includes(r.request().url()) || out.externalRequests.push(r.request().url()); r.abort() })
  await page.addInitScript(seeded)
  const resp = await page.goto(URL_); out.previewServed = resp.ok()
  await page.waitForFunction(() => document.querySelectorAll('#fSettingsPresets option').length > 0)
  return { page, errors, ctx }
}
const set = (page, id, v) => page.evaluate(([id, v]) => { const e = document.getElementById(id); typeof v === 'boolean' ? e.checked = v : e.value = v; e.dispatchEvent(new Event('change')) }, [id, v])
const pixels = page => page.evaluate(() => { const c = document.getElementById('fCanvas'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i]) n++; return { w: c.width, h: c.height, n } })
async function load(page, i, o) { // select preset i, apply options, regenerate, wait for animation
  await page.evaluate(i => { const s = document.getElementById('fSettingsPresets'); s.value = i; s.dispatchEvent(new Event('change')) }, i)
  for (const [k, v] of Object.entries(o)) await set(page, k, v)
  await page.click('#GenerateButton')
  await page.waitForTimeout(o.fSettingsAnimate ? 1500 : 100)
  return pixels(page)
}

try {
  const VIEWPORTS = { desktop: { width: 1280, height: 800 }, small: { width: 600, height: 500 } }
  for (const [vn, vp] of Object.entries(VIEWPORTS)) {
    const { page, errors, ctx } = await open(vp)
    const n = await page.evaluate(() => document.querySelectorAll('#fSettingsPresets option').length)
    if (n !== 29) failures.push(`expected 29 presets, saw ${n}`)
    const names = await page.evaluate(() => [...document.querySelectorAll('#fSettingsPresets option')].map(o => o.textContent))
    for (let i = 0; i < names.length; i++) {
      const rec = out.presets[i] ??= { name: names[i] }
      rec[vn] = {}
      for (const anim of [false, true]) {
        const a = anim ? 'animated' : 'static'
        if (anim && vn === 'small' && i % 7) continue // animation sampled on the small viewport only
        const p = await load(page, i, { fSettingsAnimate: anim, fSettingsInterval: '10' })
        rec[vn][a] = p
        // stochastic Fractal Plant 8 is seeded; others deterministic. Dragon Curve/others are non-blank at default 2 iterations.
        if (p.n === 0) failures.push(`${names[i]} blank (${vn}, ${a})`)
      }
    }
    out.viewports[vn] = { ...vp, canvas: await pixels(page).then(p => [p.w, p.h]), pageErrors: errors }
    await ctx.close()
  }

  // Forest on (bracketed Fractal Plant 2), static vs animated, two sizes: trees spread by canvas width.
  out.defects.forest = {}
  for (const [vn, vp] of Object.entries(VIEWPORTS)) {
    const { page, ctx } = await open(vp)
    const forest = { fSettingsForest: true, fSettingsCount: '5', fSettingsIterations: '3', fSettingsLength: '120' }
    const idx = out.presets.findIndex(p => p.name === 'Fractal Plant 2')
    const s = await load(page, idx, { ...forest, fSettingsAnimate: false })
    await page.evaluate(i => { const x = document.getElementById('fSettingsPresets'); x.value = i; x.dispatchEvent(new Event('change')) }, idx)
    for (const [k, v] of Object.entries({ ...forest, fSettingsAnimate: true })) await set(page, k, v)
    await page.click('#GenerateButton'); await page.waitForTimeout(4000)
    const a = await pixels(page)
    out.defects.forest[vn] = { static: s.n, animated: a.n, animatedLessThanStatic: a.n < s.n }
    await ctx.close()
  }

  // Inline onclick handlers: click Add Successor / Remove Rule in the built app.
  {
    const { page, errors, ctx } = await open(VIEWPORTS.desktop)
    await page.evaluate(() => { document.getElementById('fSettings').style.display = '' })
    await page.click('#add0'); await page.click('#removeRule0').catch(() => {})
    await page.waitForTimeout(200)
    const rulesAfter = await page.evaluate(() => document.getElementsByClassName('replacementRules').length)
    out.defects.inlineOnclick = { pageErrors: errors, ruleBlocksAfterClicks: rulesAfter, referenceErrorConfirmed: errors.some(e => e.startsWith('ReferenceError')) }
    await ctx.close()
  }

  // Scale setting: same preset with scale 1 vs 3 (seeded RNG, static).
  {
    const { page, ctx } = await open(VIEWPORTS.desktop)
    const r = {}
    for (const sc of ['1', '3']) r[sc] = await load(page, 0, { fSettingsAnimate: false, fSettingsCanvas: sc })
    out.defects.scale = { scale1: r['1'].n, scale3: r['3'].n, hasEffect: r['1'].n !== r['3'].n }
    // generation on resize: stochastic preset redraws differently after a resize event
    const idx = out.presets.findIndex(p => p.name === 'Fractal Plant 8')
    await load(page, idx, { fSettingsAnimate: false, fSettingsIterations: '4' })
    const before = await page.evaluate(() => document.getElementById('oView').textContent)
    await page.setViewportSize({ width: 1281, height: 800 }); await page.waitForTimeout(300)
    const after = await page.evaluate(() => document.getElementById('oView').textContent)
    out.defects.regenerateOnResize = { outputChanged: before !== after }
    await ctx.close()
  }
} finally {
  await browser.close(); preview.kill()
}
out.failures = failures
writeFileSync(root + 'docs/browser-baseline.json', JSON.stringify(out, null, 1) + '\n')
console.log(JSON.stringify({ failures, defects: out.defects, external: out.externalRequests, previewServed: out.previewServed }, null, 1))
if (failures.length) process.exit(1)
