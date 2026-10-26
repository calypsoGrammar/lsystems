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
