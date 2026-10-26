// Diagnostic baseline for the 29 presets in src/javascripts/main.ts (CAL-1269).
// Read-only: evaluates the preset definitions from the source and re-implements
// Iterate()/GetLines() (a port, main.ts touches the DOM on import) with a seeded RNG.
// Usage: node scripts/baseline.mjs [--check]   (writes / verifies docs/baseline.json)
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const root = fileURLToPath(new URL('..', import.meta.url))
const src = readFileSync(root + 'src/javascripts/main.ts', 'utf8')
const classes = src.slice(src.indexOf('class Successor'), src.indexOf('const primaryButton'))
const presets = src.slice(src.indexOf('let kochIsland'))
const js = ts.transpileModule(classes + 'const lSystems = [];\n' + presets + '\nreturn { lSystems, defined: [' +
  [...presets.matchAll(/^let (\w+) = new RuleSet/gm)].map(m => m[1]).join(',') + '] };',
  { compilerOptions: { target: 'ES2020' } }).outputText
const { lSystems, defined } = new Function(js)()

function rng(seed) { // mulberry32
  return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}

// Port of Iterate() including its quirks (every matching rule appends; i > 1 context guard).
function iterate(rs, current, rand) {
  let next = ''
  for (let i = 0; i < current.length; i++) {
    const c = current.charAt(i); let triggered = false
    for (const rule of rs.rules) {
      if (c != rule.predecessor) continue
      const { contextL, contextR } = rule
      if (contextL !== undefined && i > 1 && rs.ignore !== undefined && contextL !== '*') {
        let leftC = current.charAt(i - 1)
        if (leftC === ']') { let counter = i, inc = 1; while (counter > 0) { inc++; if (current.charAt(i - inc) === '[') { inc++; leftC = current.charAt(i - inc); break } counter-- } }
        if (leftC !== contextL && !rs.ignore.includes(leftC)) continue
      }
      if (contextR !== undefined && i < current.length - 1 && rs.ignore !== undefined && contextR !== '*') {
        let rightC = current.charAt(i + 1)
        if (rightC === '[') { let counter = i, inc = 1; while (counter < current.length) { inc++; if (current.charAt(i + inc) === ']') { inc++; rightC = current.charAt(i + inc); break } counter++ } }
        if (rightC !== contextR && !rs.ignore.includes(rightC)) continue
      }
      if (rule.successors.length > 0) {
        const pick = rand(); let acc = 0
        for (const s of rule.successors) { acc += s.weight; if (acc >= pick) { next += s.successor; triggered = true; break } }
      } else throw new Error('blank successor list: original code throws TypeError here')
    }
    if (!triggered) next += c
  }
  return next
}

// Turtle geometry as in GetLines(): 270deg start, 2dp rounding, [ ] stack. Returns counts + bbox.
function geometry(str, theta, len) {
  let x = 0, y = 0, rot = 270, n = 0, minX = 0, maxX = 0, minY = 0, maxY = 0; const st = []
  const r2 = v => parseFloat(v.toFixed(2))
  for (const ch of str) {
    if (ch === 'F' || ch === 'G' || ch === 'f') {
      const a = rot * Math.PI / 180, nx = r2(x + len * Math.cos(a)), ny = r2(y + len * Math.sin(a))
      if (ch !== 'f') n++
      x = nx; y = ny; minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y)
    } else if (ch === '+') rot = (rot + theta) % 360
    else if (ch === '-') rot = (rot - theta + 360) % 360
    else if (ch === '[') st.push([x, y, rot])
    else if (ch === ']' && st.length) [x, y, rot] = st.pop()
  }
  return { lines: n, bbox: [minX, minY, maxX, maxY].map(r2) }
}

const kind = rs => rs.rules.some(r => r.successors.length > 1) ? 'stochastic'
  : rs.rules.some(r => r.contextL !== '*' && r.contextL !== '' || r.contextR !== '*' && r.contextR !== '') ? 'context-sensitive'
  : /[\[\]]/.test(rs.start + rs.rules.map(r => r.successors.map(s => s.successor).join()).join()) ? 'bracketed' : 'deterministic'

const ITER = [0, 1, 2, 3]; const MAXLEN = 200000
const out = { source: 'src/javascripts/main.ts', factor: 4, notPushed: defined.filter(d => !lSystems.includes(eval(d))).length, presets: [] }
for (const rs of lSystems) {
  const e = { name: rs.name, kind: kind(rs), axiom: rs.start, theta: rs.theta, factor: rs.factor, ignore: rs.ignore,
    rules: rs.rules.map(r => ({ predecessor: r.predecessor, successors: r.successors, contextL: r.contextL, contextR: r.contextR })), iterations: {} }
  for (const seed of e.kind === 'stochastic' ? [1] : [0]) {
    const rand = rng(seed); let cur = rs.start, len = 250
    for (let i = 0; i <= Math.max(...ITER); i++) {
      if (i > 0) { len /= rs.factor; cur = iterate(rs, cur, rand) }
      if (cur.length > MAXLEN) { e.iterations[i] = { length: cur.length, skipped: 'over ' + MAXLEN }; continue }
      e.iterations[i] = { length: cur.length, string: cur.length <= 400 ? cur : undefined, ...geometry(cur, rs.theta, len) }
    }
  }
  if (e.kind === 'stochastic') e.seed = 1
  out.presets.push(e)
}
const json = JSON.stringify(out, null, 1) + '\n'
const file = root + 'docs/baseline.json'
if (process.argv.includes('--check')) {
  if (readFileSync(file, 'utf8') !== json) { console.error('baseline.json differs from current source'); process.exit(1) }
  console.log('baseline matches (' + out.presets.length + ' presets)')
} else { writeFileSync(file, json); console.log('wrote docs/baseline.json,', out.presets.length, 'presets') }
