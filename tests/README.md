# Tests (CAL-1271)

Run everything with `npm test` (vitest, no browser, no network, no credentials). Also part of `npm run check`, CI and the
Archon verify commands in `WORKFLOW.md`.

| File | Covers |
|---|---|
| `presets.test.ts` | All 29 presets enumerated (name, axiom, theta, kind, size at iteration 2), bracket balance, well-known deterministic strings |
| `rewrite.test.ts` | Weight-selection boundaries, seeded stochastic reproducibility, context-sensitive and ignore-list semantics |
| `turtle.test.ts` | F/G/f/+/-/[ ] interpretation, leaf and branch flags, bounds, edge-case dimensions, forest start positions |
| `geometry.test.ts` | Geometry snapshots (`fixtures/geometry.json`) for curves and plants at five viewport aspect ratios, with a 0.05 px tolerance |
| `known-defects.test.ts` | Known existing defects, kept apart from the correct-behaviour tests (see below) |

## Code under test

The rewrite, turtle and preset code was moved unchanged out of `src/javascripts/main.ts` into
`src/javascripts/lsystem/` (`model.ts`, `presets.ts`, `rewrite.ts`, `turtle.ts`) so it can be imported without a DOM.
The only change is an optional random-source parameter (defaults to `Math.random`) on `rewrite` and `forestStart`.
`main.ts` still owns the DOM, canvas and colour randomness, which are not unit tested; `npm run test:browser` covers them.
Tests use a seeded generator (`tests/helpers.ts`); there is no seed UI.

## Known defects

`known-defects.test.ts` pairs, for each defect in `docs/AUDIT.md`, a *current behaviour* test (pins what the code does
today; not a claim it is right) with an `it.fails` *desired behaviour* test. When a defect is fixed, its `it.fails`
starts failing: delete the current-behaviour test and change `it.fails` to `it`. Not covered by unit tests because the
code stays in `main.ts`: `Draw()` crashing when no line is drawn, the broken inline rule-editor handlers, the ignored
Scale setting, resize regeneration.

Recorded in `geometry.test.ts`: drawings do not fit small canvases (no fit-to-canvas) and the UI truncates non-integer thetas.

## Fixtures

- `fixtures/geometry.json`: regenerate with `UPDATE_FIXTURES=1 npm test` after an *intended* geometry change and review the diff.
- Cantor Set is defined in `presets.ts` but not registered, so it is not one of the 29.

## Not done

No pixel/screenshot comparison: canvas rendering depends on the browser build. Visual coverage is the geometry
snapshots here plus the existing Playwright smoke check (`npm run test:browser`, `npm run audit:browser`).

## Grammar engine (CAL-1272)

`src/javascripts/lsystem/grammar.ts` (validation, `expandGrammar`, limits) and `rewrite.ts` are DOM-free; `grammar.test.ts` covers them.
- Limits: 500 000 symbols per generation, 2 000 000 over all generations of one tree, iterations 0–25. Exceeding them throws `ExpansionLimitError` / `GrammarError`; `main.ts` expands before touching the canvas and shows the message in `#fError`, keeping the previous drawing.
- Context traversal: `[...]` branches are skipped with nesting respected (previously the nearest bracket was used); unbalanced brackets do not match unless ignored.
- A rule with no successors leaves its symbol unchanged (previously a TypeError). Weights must be finite, >= 0 and total <= 1; a total below 1 leaves the symbol unchanged for the remainder.
- Parity: `parity.test.ts` compares every preset with `docs/baseline.json` (iterations 0-3) and with a frozen copy of the old rewrite (`legacyRewrite.ts`). Only Fractal Plant 9 differs, first at iteration 5 (251 vs 252 symbols), because nested branches are now skipped as a whole; all other presets are identical to iteration 4.
- Performance: line tracing and the leaf check are now O(n) (Map/Set on segment start points), the output panel is built once per tree, and the forest shares one total budget across trees.
- Unchanged on purpose: every matching rule contributes (Fractal Plant 9 relies on it), the `i > 1` / `''`-context quirks above.

## Turtle geometry and auto fit (CAL-1273)

`fit.test.ts` covers `interpretTurtle` (turtle.ts, full-precision, canvas-free; bounds over drawn segments only, `null` when nothing is drawn) and `fit.ts` (`fitTransform`, `mergeBounds`, `validateRenderSettings`). Cases: branching, curve, polar/rotated, fractional angle, long/thin, forest, all presets, at mobile (portrait/landscape), tablet, desktop and wide canvases.
- Fit: uniform scale, drawing centred on the canvas, padding = 5% of the shorter side (minimum 8 px, at most a quarter of the side). Tests assert the drawn bounds lie inside the padding, are centred to 1e-6 px and that the limiting side fills the padded area.
- `main.ts`: the Auto fit checkbox (default on) fits all trees as one scene; **Fit to View** turns it back on, **Reset View** restores length 250, scale 1 and auto fit. With auto fit off, Starting Length and Scale are honoured (scale is a uniform multiplier, drawing centred). The reduction factor is a visible field filled from the selected preset (all presets are 4, so appearances are unchanged); the hardcoded 4 is gone.
- Canvas: backing store is CSS size x `devicePixelRatio`; the context transform is set (never accumulated) after every resize. Theta and length are no longer truncated to integers (`parseFloat`), so presets with fractional angles (e.g. 22.5, 25.7) now draw at their true angle.
- `traceLines` (2 dp rounding, canvas-centred bounds) and `layout.ts` remain only for the legacy fixtures/parity tests; the app no longer uses them.
- Limitation: with animation on, a forest still animates only its last tree (existing behaviour, left for follow-up). Leaf size is in screen pixels, so leaves are not scaled with the fit.

## Rule editor (CAL-1274)

`editor.test.ts` covers `src/javascripts/lsystem/editor.ts`, the editable ruleset state (typed strings, add/remove rule and
successor, validation per field, conversion to an engine `RuleSet`), which is independent of the DOM and of the grammar engine.
The DOM binding (`src/javascripts/editor-ui.ts`) is exercised in `npm run test:browser`: edits surviving add/remove, markup
staying inert, inline accessible errors, preset switch/reset semantics and a 320 px layout check.
