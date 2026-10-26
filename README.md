# L-Systems
## Toolchain

- Supported Node: `^20.19.0 || >=22.12.0` (required by Vite 8); `.nvmrc` pins 26, the version Archon and the local build use (Node 26.11.1, npm 11.20.0). CI runs 22 and 26.
- Clean install: `npm ci`
- Typecheck: `npm run typecheck`
- Production build: `npm run build` (output in `dist/`)
- Dependency audit: `npm run audit` (fails on high/critical advisories)
- Everything CI runs: `npm run check`
- Browser check (needs Playwright; see header of `scripts/browser-check.mjs`): `npm run test:browser` after a build
- Preset regression: `npm run audit:baseline:check`

Stack: Vite 8, TypeScript 6, Tailwind CSS 4 (`@tailwindcss/postcss`, content from `index.html` and `src/javascripts` via `@source` in `src/stylesheets/style.css`), modern-normalize bundled from npm. TypeScript stays on 6.x because 7.x (native compiler) has no JS API, which `scripts/baseline.mjs` uses. jQuery was removed: nothing in the source referenced it.

modern-normalize is imported into the `base` cascade layer so it cannot override Tailwind utilities. The dynamic `primaryButton` classes in `main.ts` deliberately carry no dark-background/white-text tokens, keeping the previous black-on-white look.

`WORKFLOW.md` verify runs `npm run test:browser` (Playwright from the Archon environment's default paths); this takes effect once the change to `WORKFLOW.md` is merged. CI installs Playwright 1.55.1 with one shared `PLAYWRIGHT_BROWSERS_PATH`.

## Tests

`npm test` runs the unit and geometry tests (see `tests/README.md`).

## Release and deployment (V1)

Full runbook, rollback and live smoke checklist: [`docs/RELEASE.md`](docs/RELEASE.md). Deployment path per the owner: GitHub Pages from the `deploy` branch, canonical host `https://lsystems.calypsogrammar.com/`. No migration or DNS change is part of V1.

**Live verification pending, owner-controlled blocker open.** The agent had no access to the live site or hosting, so no publication, DNS/header inspection or production smoke test has been done, and V1 is not declared deployed. The owner (or an approved operator) must run the publish and smoke steps and record the result below.

### Release record

| Field | Value |
|---|---|
| Verified source revision | `cf1efc8ab2fd34579c019f2433d917dd262514f7` plus the CAL-1277 commit (docs and all-29-preset browser loop); the release SHA is the merge commit on `main` |
| Published deploy commit / date / operator | pending |
| Live smoke result | pending |
| Build and security checks (local) | `npm ci`, typecheck, preset baseline (29), build, `npm test` (536 pass, 3 expected failures), `npm run test:browser` (all 29 presets, mobile and desktop), `npm audit`: 0 vulnerabilities. Details in `docs/RELEASE.md` |

### Known limitations

- Documented, unfixed behaviours are listed in `docs/AUDIT.md` and pinned by `tests/known-defects.test.ts` (e.g. Dragon Curve and Fractal Plant 7 use empty contexts so they stall; fractional thetas are truncated; per-preset `factor` is ignored; `Cantor Set` is defined but unregistered).
- `dist/` is partly tracked in git (`index.html`, SVGs) but `dist/assets/` is not; always rebuild before publishing.
- Hosting facts (DNS, headers, Pages settings, `CNAME`, caching) are unverified.
- 3D and AI asset generation stay deferred to V2 research; V1 adds no backend, accounts, or generation features.
