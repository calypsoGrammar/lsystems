# L-Systems
## Toolchain

- Supported Node: `^20.19.0 || >=22.12.0` (required by Vite 8); `.nvmrc` pins 26, the version Archon and the local build use (Node 26.11.1, npm 11.20.0). CI runs 22 and 26.
- Clean install: `npm ci`
- Typecheck: `npm run typecheck`
- Production build: `npm run build` (output in `dist/`)
- Dependency audit: `npm run audit` (fails on high/critical advisories)
- Unit and geometry tests: `npm test` (Vitest, no browser, network or credentials; runs in about 2 s). See [Tests](#tests).
- Everything CI runs: `npm run check`
- Browser check (needs Playwright; see header of `scripts/browser-check.mjs`): `npm run test:browser` after a build
- Preset regression: `npm run audit:baseline:check`

Stack: Vite 8, TypeScript 6, Tailwind CSS 4 (`@tailwindcss/postcss`, content from `index.html` and `src/javascripts` via `@source` in `src/stylesheets/style.css`), modern-normalize bundled from npm. TypeScript stays on 6.x because 7.x (native compiler) has no JS API, which `scripts/baseline.mjs` uses. jQuery was removed: nothing in the source referenced it.

modern-normalize is imported into the `base` cascade layer so it cannot override Tailwind utilities. The dynamic `primaryButton` classes in `main.ts` deliberately carry no dark-background/white-text tokens, keeping the previous black-on-white look.

`WORKFLOW.md` verify runs `npm run test:browser` (Playwright from the Archon environment's default paths); this takes effect once the change to `WORKFLOW.md` is merged. CI installs Playwright 1.55.1 with one shared `PLAYWRIGHT_BROWSERS_PATH`.

## Tests

`npm test` runs Vitest over `tests/`. The rewrite, turtle and preset code lives in `src/javascripts/lsystem.ts` and `src/javascripts/presets.ts` (extracted unchanged from `main.ts`, which keeps only DOM and canvas code). The rewrite and forest functions take an optional random source that defaults to `Math.random`; tests inject a seeded generator (`tests/helpers.ts`), so no seed UI is needed.

- `presets.test.ts`: all 29 presets (names, definitions, expansion to depth 3, well-known strings, stochastic reproducibility). Definitions and expansions are Vitest snapshots in `tests/__snapshots__/`.
- `rewrite.test.ts`: rule expansion, weight boundaries, context/ignore/bracket-jump semantics, invalid input.
- `turtle.test.ts`: F/G/f/+/-/[ ] interpretation, leaf/branch flags, rotation, bracket balance for every preset, forest placement.
- `geometry.test.ts`: segment counts, bounds and centring offsets for every preset at four viewport sizes, plus edge-case dimensions. Numbers are rounded to whole pixels before comparison (the tolerance); the header of the file lists differences caused by existing bugs. These stand in for pixel screenshots; the Playwright check (`npm run test:browser`) remains the real-canvas smoke test.
- `known-defects.test.ts`: the **correct** behaviour for each documented defect, marked `it.fails` so it passes while the defect exists and fails once it is fixed (then drop `.fails`). Nothing else relies on defective behaviour. `it.todo` entries list defects that need a browser.

Intentional changes to presets or algorithms: run `npx vitest run -u` and review the snapshot diff.
