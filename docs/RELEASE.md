# L-Systems V1 release, deployment and rollback runbook (CAL-1277, LSYS-V1-09)

Status: **live verification pending.** The deployment workflow is prepared for review; no production deployment or live smoke test has been performed as part of this change.

## Deployment configuration

GitHub Pages is configured for GitHub Actions publishing (`build_type: workflow`). The API currently reports `https://calypsogrammar.github.io/lsystems/` and no custom domain, although the historical source field still names `deploy` and the last historical Pages run used that branch. The new workflow publishes an artifact directly and does not write to `deploy`.

Owner decision (CAL-1651, superseding the custom host intended in CAL-1277): the site is served from GitHub Pages at `https://calypsogrammar.github.io/lsystems/` and the custom domain `lsystems.calypsogrammar.com` is scrapped. Do not add a `CNAME` file or configure a custom domain or DNS. Cloudways migration remains out of scope.

## Build facts

- `npm run build` (`tsc && vite build`) writes `dist/`. `vite.config.js` sets `base: ''`, so `dist/index.html` uses relative URLs (`./assets/index-<hash>.js`, `./assets/index-<hash>.css`, `./undo.svg`, ...). It works at a domain root and under a sub-path; there are no root-relative (`/assets/...`) URLs in the built HTML. Do not set an absolute `base` without checking this.
- The app makes no network requests besides its own files (`npm run test:browser` aborts and fails on any off-origin request).
- `dist/` is gitignored and no longer tracked (CAL-1554); it only exists after a build, and the deploy publishes a freshly built one.

## Publish procedure

1. Merge the change into `main`. Merging does not publish.
2. The `CI` workflow runs the typecheck, preset baseline, build, unit tests, browser check and security audit on Node 22 and 26 (jobs `build (22)` and `build (26)`). CI never publishes.
3. Actions → **deploy** → Run workflow, with **Dry run** unticked and `ref` empty (main) or the commit to publish. `.github/workflows/deploy.yml` calls the shared `github-pages.yml` in `calypsoGrammar/deploy-workflows`. It refuses a commit that is not on `main` or on which either CI job did not pass, then runs `npm ci` and `npm run build` on Node 22 and publishes `dist/` with `actions/deploy-pages`. A dry run (the default) builds and checks without publishing. Every real run records a GitHub deployment with task `release`, and one publish runs at a time.
4. The run's `github-pages` environment shows the published URL. Run the smoke checklist below against it and record the source SHA, run URL, date, operator and result in `README.md`.

Re-running the historical `pages-build-deployment` run only republishes its old source and is not the release procedure. Do not copy files or push to the historical `deploy` branch.

If deployment fails, check Settings → Pages → Build and deployment → Source is **GitHub Actions**, and inspect the `github-pages` environment rules. Branch protection and any required approvals remain in force. CI has no Pages write or OIDC permissions; those belong only to the deploy workflow.

HTTPS: keep "Enforce HTTPS" enabled and check `curl -sI http://calypsogrammar.github.io/lsystems/` redirects to `https://`.

Cache invalidation: asset file names are content-hashed, so a new build never reuses an asset URL; only `index.html` (and the unhashed SVGs) can be stale, for up to about 10 minutes on Pages. Verify with a cache-busting request (`curl -sI "https://calypsogrammar.github.io/lsystems/?x=$(date +%s)"`) and a hard reload. If a CDN or Cloudflare proxy is found in front, purge it after publishing.

## Rollback

Run Actions → deploy with **Dry run** unticked and the last good commit or tag as `ref`, or tick **rollback** with `ref` empty to publish the `stable` tag. A rollback holds later deploys until main is fixed and the hold is cleared (Actions → stable → Run workflow → `clear-hold`). `stable.yml` moves the `stable` tag to a release once it has been live for 48 hours. Repeat the live smoke checklist and record the rollback source SHA and deployment run in `README.md`. Reverting a historical `deploy` branch commit has no effect on the new workflow.

## Live inspection commands (to complete the open items)

```
curl -sI https://calypsogrammar.github.io/lsystems/         # Server, via, x-github-request-id, cache-control, etag
curl -s https://calypsogrammar.github.io/lsystems/ | grep -o 'assets/[^"]*'   # compare with the local dist/ hashes
curl -sI https://calypsogrammar.github.io/lsystems/assets/<js file from above> # 200, content-type text/javascript
gh api repos/calypsoGrammar/lsystems/pages              # build_type, html_url, cname, https_enforced
```
A `Server: GitHub.com` header with `x-github-request-id` confirms Pages; Varnish/nginx/Cloudways headers mean the premise is wrong: stop and ask the owner before changing anything.

## Live smoke checklist (not yet run)

Run in a desktop and a phone-sized (or real mobile) browser with DevTools open; no failed requests, no console errors.

- [ ] Page loads over HTTPS at the Pages URL; CSS/JS/icons/SVG load from the published URL (no 404, no root-relative failures).
- [ ] Preset menu lists 29 presets; each draws a non-blank, fitted, centred picture (the local browser check does all 29 at 375x667 and 1280x800).
- [ ] Stochastic (Fractal Plant 8) varies between Generate clicks; context-sensitive (Fractal Plant 9) and bracketed plants draw.
- [ ] Custom rule editing: change an axiom, a rule and the angle, Generate, picture updates; Add/Remove rule and successor work; Reset to preset restores.
- [ ] Seeded/stochastic/branch-context behaviour matches `docs/baseline.json` for the same settings (use a seed if the UI exposes one).
- [ ] Resize the window / rotate the phone: the scene refits without regenerating the stochastic output.
- [ ] Leaves on; Forest with several trees; Animation on (all trees finish) and off.
- [ ] Long output: raise iterations on a heavy preset; the app stays responsive, the generated-strings view stays usable (sectioned/limited).
- [ ] Mobile: toolbar buttons reachable and at least touch-sized, settings panel usable, no horizontal scroll.

## Evidence from the agent's environment (pre-release, local only)

Source revision tested: `cf1efc8ab2fd34579c019f2433d917dd262514f7` (`main`) plus the CAL-1277 commit that adds this file and the all-presets browser loop. Node v26.11.1, npm 11.20.0, fresh `npm ci`.

| Check | Result |
|---|---|
| `npm ci --no-audit --no-fund` | pass (63 packages) |
| `npm run typecheck` | pass |
| `npm run audit:baseline:check` | pass (29 presets match `docs/baseline.json`) |
| `npm run build` | pass; `index-Dddbx25E.js`, `index-DUvfYkEH.css`, `favicon-B0opx7u9.ico` |
| `npm test` | pass: 536 passed, 3 expected failures (documented known defects in `tests/known-defects.test.ts`), 10 files |
| `npm run test:browser` | pass; now draws every one of the 29 presets at mobile (375x667 @2x) and desktop (1280x800) and asserts non-blank, padded and centred, plus the earlier checks |
| `npm audit --audit-level=high` / `npm audit` | 0 vulnerabilities |
| Live site | **not checked** |
