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
- Unchanged on purpose: every matching rule contributes (Fractal Plant 9 relies on it), the `i > 1` / `''`-context quirks above.
