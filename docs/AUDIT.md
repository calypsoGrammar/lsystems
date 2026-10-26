# L-Systems audit (CAL-1269, LSYS-V1-01)

Diagnostic only. No presets, hosting, DNS or production files were changed.

## Source revision and environment

- Repository revision audited: `0f146fd8a6d3bf35e3dff6c51ce26124fafbf7e1` (`main`, merge of PR #1, 2026-10-24); work branch `archon/CAL-1269`. App source last changed 2023-04-23 (`b719b74`).
- Working toolchain: Node v26.11.1, npm 11.20.0 (also what `WORKFLOW.md` runs with `npm ci --no-audit --no-fund`). No `engines` field or `.nvmrc` exists; no older Node was tried. Dependencies: vite 4.3.x (built with 4.3.1, esbuild 0.17.18), typescript ^5.0.2, tailwindcss ^3.3.1, postcss, autoprefixer.
- Fresh clone, `npm ci` then `npm run build` (`tsc && vite build`): **passes**, 4 modules, about 1.4 s. Warnings only: outdated `caniuse-lite`, and an npm notice that esbuild's postinstall is not yet covered by `allowScripts`.
- The fresh build output is **byte-identical** to the committed `dist/` (`diff -rq` empty): `index-145e5bc5.js`, `index-6e5e16f9.css`, `favicon-82fbd818.ico`, `index.html`, four SVGs. So the committed `dist/` is not stale relative to this source.
- There are no tests, lint or other scripts (`dev`, `build`, `preview` only). The only regression aid is `npm run audit:baseline` / `audit:baseline:check` added here (see below).
- Local preview (`npm run preview`) and a real browser were **not** exercised in this run; behaviour below marked "static" comes from reading source/built output, not from running it in a browser.

## Build output and asset paths

- `vite.config.js` sets `base: ''`, so `dist/index.html` uses relative URLs (`./assets/...`, `./undo.svg`), which work from any sub-path or a custom domain root. The source `index.html` uses root-absolute `/undo.svg` etc.; Vite rewrites these to `./` at build time.
- `dist/` is listed in `.gitignore` yet **is tracked** (force-added in the 2023 "deploy" commits). Any rebuild changes tracked files.
- Externally fetched resources (both in the built HTML): `https://code.jquery.com/jquery-3.6.4.min.js` (jQuery is never used by `main.ts`) and `https://cdn.jsdelivr.net/npm/modern-normalize@v1.1.0/modern-normalize.min.css`. No SRI on either. No other network use found in the JS or CSS.
- `tailwind.config.js` scans only `./index.html`, so classes that exist only in `main.ts` strings (e.g. `primaryButton`, `fBorder`) are not generated; the button styling built in `FillReplacement` is therefore partly unstyled.

## Deployment provenance (open)

- The repository has no CI config, no `CNAME`, no GitHub Pages workflow and no Cloudways config. The local checkout has no remote `origin` and no `deploy` branch (only `archon/main`), so the `deploy` branch named in the ticket could not be inspected here. Commit messages "deploy" (`6459df9`, `23466e5`) suggest dist was committed to the main history.
- `https://lsystems.calypsogrammar.com/` could not be fetched: the sandbox network allowlist blocked the host (HTTP 403 from the proxy) and DNS is unavailable. **Nothing is claimed about what is live**, nor whether Cloudways or GitHub Pages is authoritative.
- Operator-only verification handoff (still open):
  1. `dig lsystems.calypsogrammar.com` (CNAME to `*.github.io` suggests Pages; an A record to a Cloudways server suggests Cloudways) and response headers (`Server`, `x-github-request-id`, `x-served-by`, Cloudways/Varnish/nginx headers).
  2. Fetch the live `index.html` and compare the asset hashes with `index-145e5bc5.js` / `index-6e5e16f9.css` above.
  3. GitHub repo Settings → Pages (source branch/folder, custom domain), the `deploy` branch contents/head commit, and the Cloudways application's webroot / Git deployment settings.
  4. Record which is canonical release source before any later ticket touches hosting.

## Source architecture (`src/javascripts/main.ts`, 1417 lines, single module)

- Model classes: `Colour`, `Line`, `Vector`, `Transform`, `Successor` (text + weight), `Rule` (predecessor, successors, `contextL`, `contextR`), `RuleSet` (name, axiom, theta, factor, rules, ignore).
- Presets are top-level `new RuleSet(...)` values pushed to `lSystems` at the bottom of the file (after `Main` is registered but before `DOMContentLoaded` fires).
- UI: `Main` → `FillSelect`, `UpdateSelect(0)` (copies preset into the form, resets iterations=2, length=250, scale=1), `GetSystem`. `FillReplacement` renders the rule editor as `innerHTML` strings. `GetSystem` rebuilds a `RuleSet` **from the DOM form** each time; it never reads preset objects directly.
- Pipeline: `GetSystem` → `Initiate` (clear, size canvas, per tree: `Iterate` × N, `GetLines`, `Draw`) → `DrawLine` (animated via `setInterval`, or synchronously). `oView` shows every generation's string.
- Semantics: turtle with `F`/`G` draw, `f` move, `+`/`-` rotate by theta, `[`/`]` push/pop; start angle 270 (up); lengths and positions rounded to 2 dp; length is divided by the factor every iteration; colour is a random walk (`Colour Variance`); `Leaves` draws an ellipse at leaf ends; `Forest` starts `Count` trees along the bottom edge with random offsets.
  - **Deterministic**: single successor, no context. **Stochastic**: several successors with weights, a single `Math.random()` pick against cumulative weights. **Context-sensitive**: `contextL`/`contextR` compared with the neighbouring char, skipping chars in `ignore`, and jumping over a bracketed branch (`]`…`[` on the left, `[`…`]` on the right). `'*'` means any. **Bracketed**: `[`/`]` stack in `GetLines`. **Forest**: described above.
  - Every rule whose predecessor matches appends its successor (rules are not exclusive), so duplicate predecessors with non-overlapping contexts (Fractal Plant 9) work, while overlapping ones double up.

## Preset inventory (29 registered)

Generated by `scripts/baseline.mjs` from the source; full data (rules, ignore list, strings for iterations 0–3 up to 400 chars, line counts, bounding boxes at length 250/factor 4) is in `docs/baseline.json`. Columns "Len/Lines" are expanded string length / drawn segments. The stochastic preset uses seed 1 so its numbers are reproducible; in the app it is random on every run. Kind is inferred from the rule data; contexts other than `'*'` are shown as `[L=… R=…]`.

| # | Name | Kind | Axiom | Theta | Rules | Iter 2 Len/Lines | Iter 3 Len/Lines |
|---|---|---|---|---|---|---|---|
| 1 | Koch Island | deterministic | `F-F-F-F` | 90 | F→F-F+F+FF-F-F+F | 475 / 256 | 3803 / 2048 |
| 2 | Koch Curve 2 | deterministic | `-F` | 90 | F→F+F-F-F+F | 50 / 25 | 250 / 125 |
| 3 | Lakes and Islands | deterministic | `F+F+F+F` | 90 | F→F+f-FF+F+FF+Ff+FF-f+FF-F-FF-Ff-FFF; f→ffffff | 2595 / 1296 | 47283 / 23328 |
| 4 | Ruleset 1 | deterministic | `F-F-F-F` | 90 | F→FF-F-F-F-F-F+F | 475 / 256 | 3803 / 2048 |
| 5 | Ruleset 2 | deterministic | `F-F-F-F` | 90 | F→FF-F-F-F-FF | 327 / 196 | 2287 / 1372 |
| 6 | Ruleset 3 | deterministic | `F-F-F-F` | 90 | F→FF-F+F-F-FF | 327 / 196 | 2287 / 1372 |
| 7 | Ruleset 4 | deterministic | `F-F-F-F` | 90 | F→FF-F--F-F | 199 / 100 | 999 / 500 |
| 8 | Ruleset 5 | deterministic | `F-F-F-F` | 90 | F→F-FF--F-F | 199 / 100 | 999 / 500 |
| 9 | Ruleset 6 | deterministic | `F-F-F-F` | 90 | F→F-F+F-F-F | 199 / 100 | 999 / 500 |
| 10 | Dragon Curve | deterministic | `FX` | 90 | X→X+YF+; Y→-FX-Y [L='' R=''] | 10 / 3 | 14 / 4 |
| 11 | Sierpinski Curve | deterministic | `F--XF--F--XF` | 45 | X→XF+G+XF--F--XF+G+X | 182 / 64 | 726 / 256 |
| 12 | Sierpinkski Triangle | deterministic | `F-G-G` | 120 | F→F-G+F+G-F; G→GG | 45 / 27 | 135 / 81 |
| 13 | Koch Curve 1 | deterministic | `F` | 60 | F→F+F--F+F | 36 / 16 | 148 / 64 |
| 14 | Koch Snowflake | deterministic | `F--F--F` | 60 | F→F+F--F+F | 112 / 48 | 448 / 192 |
| 15 | Hilbert Curve | deterministic | `A` | 90 | A→+BF-AFA-FB+; B→-AF+BFB+FA- | 51 / 15 | 211 / 63 |
| 16 | Levy C Curve | deterministic | `F` | 45 | F→+F--F+ | 16 / 4 | 36 / 8 |
| 17 | Star | deterministic | `F` | 77 | F→F++F | 10 / 4 | 22 / 8 |
| 18 | Pentigree Curve | deterministic | `F-F-F-F-F` | 72 | F→F-F-F++F+F-F | 394 / 180 | 2374 / 1080 |
| 19 | Snowflake | deterministic | `F++F++F++F++F` | 36 | F→F++F++F+++++F-F++F | 608 / 180 | 3668 / 1080 |
| 20 | Gosper Curve | deterministic | `F` | 60 | F→F-G--G+F++FF+G-; G→+F-GG--G-F++F+G | 113 / 49 | 799 / 343 |
| 21 | Fractal Plant 1 | bracketed | `X` | 25 | X→F+[[X]-X]-F[-FX]+X; F→FF | 89 / 18 | 379 / 84 |
| 22 | Fractal Plant 2 | bracketed | `F` | 25.7 | F→F[+F]F[-F]F | 61 / 25 | 311 / 125 |
| 23 | Fractal Plant 3 | bracketed | `F` | 22.5 | F→FF-[-F+F+F]+[+F-F-F] | 172 / 64 | 1388 / 512 |
| 24 | Fractal Plant 4 | bracketed | `F` | 20 | F→F[+F]F[-F][F] | 73 / 25 | 373 / 125 |
| 25 | Fractal Plant 5 | bracketed | `X` | 20 | X→F[+X]F[-X]+X; F→FF | 47 / 10 | 156 / 38 |
| 26 | Fractal Plant 6 | bracketed | `X` | 25.7 | X→F[+X][-X]FX; F→FF | 43 / 10 | 143 / 38 |
| 27 | Fractal Plant 7 | bracketed | `X` | 22.5 | X→[[X]+X]+F[+FX]-X [L='' R='']; F→FF | 18 / 4 | 22 / 8 |
| 28 | Fractal Plant 8 | stochastic | `F` | 20 | F→F[+F]F[-F]F@0.34\|F[+F]F@0.33\|F[-F]F@0.33 | 26 / 11 | 96 / 39 |
| 29 | Fractal Plant 9 | context-sensitive | `F1F1F1` | 22.5 | 0→0 [L='0' R='0']; 0→1[+F1F1] [L='0' R='1']; 1→1 [L='0' R='0']; 1→1 [L='0' R='1']; 0→0 [L='1' R='0']; 0→1F1 [L='1' R='1']; 1→0 [L='1' R='0']; 1→0 [L='1' R='1']; +→-; -→+ | 42 / 9 | 77 / 15 |

Defaults when a preset is loaded: iterations 2, starting length 250, scale 1, factor 4 (hard-coded), colour variance 5, animate on, interval 10 ms.

## Anomalies in presets

1. **Cantor Set is defined but never registered** (`cantorSet`, `main.ts` at line 1092: no `lSystems.push`). Only 29 of the 30 `RuleSet`s appear in the menu, so "29 presets" excludes it. Left unchanged.
2. **Dragon Curve is not a dragon curve.** `Y` has `contextL=''`/`contextR=''` (empty, not `'*'`), so the rule can only fire when the neighbours are empty strings, which never happens beyond position 1; `X→X+YF+` then grows linearly (1, 2, 3, 4 segments over 0–3 iterations). The usual rule set also rewrites `Y`.
3. **Fractal Plant 7** has the same `''` contexts on its `X` rule: `X` is only rewritten while `i ≤ 1`, so growth stalls (iteration 3: 22 chars / 8 lines versus 379 chars for Plant 1).
4. **Non-integer thetas are truncated by the UI**: `GetSystem` uses `parseInt(theta)`, so 25.7 becomes 25 and 22.5 becomes 22 (Fractal Plants 2, 3, 6, 7, 9), and the theta input has `step=1`. `docs/baseline.json` uses the preset's own theta, so geometry of those presets differs from what the app draws.
5. **Per-preset `factor` is ignored** (hard-coded 4, see below); all presets happen to use 4.
6. **Naming**: variable `kochCurve1` is named "Koch Curve 2" and `kochCurve` "Koch Curve 1"; "Sierpinkski Triangle" is misspelled; Rulesets 2/3 and 4/5/6 are different rules with identical segment counts; Koch Island and Ruleset 1 share an axiom but have different rules.
7. **Fractal Plant 8** weights are 0.34+0.33+0.33 (sums to 1.0 within float error). If a user lowers the weights so the total is below the random pick, no successor is chosen and the character is left as is.
8. **Fractal Plant 9** (context-sensitive, ignore `+ - F`) rules 9 and 10 swap `+`/`-` every iteration; `i > 1` means position 1 never gets a context check.

## Known defects (documented, not fixed)

1. **Hard-coded `factor=4` in `GetSystem()`**: `new RuleSet("-", axiom, theta, 4, [], ignore)`; the `RuleSet.factor` of each preset is unused and not editable.
2. **Canvas scale is reset on resize/initiate**: `Initiate` calls `ctx.scale(canvasScale, …)` and *then* assigns `fCanvas.width/height`, which resets the 2D context transform, so the "Scale" setting has no visible effect (static reading; not confirmed in a browser). `ReSize` sets the size and then `GetSystem()`.
3. **Generation on resize**: every `resize` event (including orientation change and mobile address-bar changes) calls `GetSystem()`, re-expanding the string and re-randomising stochastic output, colour, forest positions and leaves, and restarting the animation. There is no debounce.
4. **DOM inline event handlers**: `FillReplacement` emits `onclick="RemoveSuccessor(i,s)"`, `AddSuccessor(i)`, `RemoveRule(i)`. `main.ts` is a module (`type="module"`), so these functions are not global (and are renamed by minification), so the buttons very likely throw `ReferenceError` in the built app (static; the committed bundle contains the attribute strings but no `window.` export). Rule/successor text, weights and ignore list are concatenated into `innerHTML` without escaping (self-XSS/markup breakage with `<`, `&`, quotes); `oView.innerHTML +=` renders strings unescaped too. Repeated `innerHTML +=` re-parses the whole editor and the `replacementRules` div is closed by the parser immediately, so it never contains its fields (lookup works by id).
5. **Blank successor handling**: "Add Successor" creates `("", 0)`; with weight 0 it is never selected (cumulative `0 >= pick` only if `pick` is exactly 0), so the character silently survives. A rule with zero successors takes the `else` branch of `Iterate`, which reads `successors[0].successor` and throws `TypeError` (the `> 0` guard makes that branch only reachable when the list is empty). A blank predecessor never matches. A form successor with a non-numeric weight gives `NaN`, never chosen. Edits made to textareas are lost when Add/Remove re-renders from the preset objects.
6. **O(n²) branch-start scan** in `GetLines`: nested loop over all lines compares start coordinates (`branchStart`), and `DrawLine` does another linear scan per leaf when `Leaves` is on. At iteration 3 for Lakes and Islands (23 328 segments) that is ~5×10⁸ comparisons; larger iterations hang the tab. `branchStart` is never read when drawing.
7. Other observations: `Iterate`'s context check uses `i > 1` (off-by-one for position 1); `Draw`'s offsets use `lines[index][0]` and crash on a system that draws no line (e.g. an axiom of only `f`/`+`); forest mode with animation: each tree's `Draw` clears the previous tree's interval and `currentIndex` is a global, so only the last tree animates and earlier ones may never finish drawing (static reading); `DrawLine` keeps drawing from a stale `lines` array after regenerate; `fDiv` is looked up but no such element exists; unused `HideSettings`, `RandomFlowerColour`, `loop`, `timeOut`; `Count` input max is 25, Interval min 10; colour set to alpha=`interval` in `Draw` (`RandomColour(inheritance, interval)`, immediately overwritten); `HexToRGB` returns `undefined` for invalid hex (cast away); `playPauseButton` is just a regenerate button with an undo icon; `RotateTransform` returns an unused object.

## Baseline tooling

- `npm run audit:baseline` rewrites `docs/baseline.json`; `npm run audit:baseline:check` fails if the preset data or derived expansion differs from the committed baseline. The script uses a **port** of `Iterate`/`GetLines` (the app module cannot be imported without a DOM), so a divergence in `main.ts` logic itself is not caught, only data and the ported behaviour. The baseline records default size parameters only (length 250, factor 4); different canvas sizes and animation settings were not captured because they need a browser (canvas size only offsets drawing, animation only changes timing).
- Not done: browser/screenshot baseline, live-site capture, inspection of the `deploy` branch, any hosting/DNS check.
