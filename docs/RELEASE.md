# L-Systems V1 release, deployment and rollback runbook (CAL-1277, LSYS-V1-09)

Status: **live verification pending.** The deployment workflow is prepared for review; no production deployment or live smoke test has been performed as part of this change.

## Deployment configuration

**Owner decision (CAL-1517 / CAL-1645):** GitHub Pages serving from the `deploy` branch is the intended, authoritative source for `https://lsystems.calypsogrammar.com/`. The repository does not yet implement this and this change does not touch the workflow, the `deploy` branch mechanics or add a `CNAME`. Every instruction in this runbook applies to one of two states, and says which: **Before the switch** (Pages source is GitHub Actions, today's state) or **After the switch** (Pages source is the `deploy` branch).

### Switch steps (a person, after merge)

1. **Pre-switch check.** The current workflow does not write to `deploy`, and that branch has never been inspected. Switching serves whatever is on it, which may be older than `main`. Inspect the `deploy` head commit and contents: it must hold a complete built site at its root (`index.html` plus every `assets/` file the HTML references). Compare it with a fresh `npm run build` from `main`. If it is behind, incomplete or missing, **stop and ask the owner**; do not switch.
2. Set Settings → Pages → Source to the `deploy` branch, `/ (root)`.
3. Set the custom domain `lsystems.calypsogrammar.com` in Pages settings (not via a `CNAME` in code).
4. Verify with the "Live inspection commands" section: `gh api repos/calypsoGrammar/lsystems/pages` must show `build_type: legacy`, `source.branch: deploy`, `source.path: /`, `cname: lsystems.calypsogrammar.com`; DNS and headers must match; the live `assets/` hashes must equal those on the `deploy` branch.

**After the switch**, merging or reverting on `main` does **not** change the live site, and the workflow's `deploy` job does not update the `deploy` branch. What that job does once the source is a branch is unverified: check the first run after the switch. No decision yet says how `deploy` receives new releases or rollbacks; ask the owner before releasing.

**Before the switch:** GitHub Pages is configured for GitHub Actions publishing (`build_type: workflow`). The API currently reports `https://calypsogrammar.github.io/lsystems/` and no custom domain, although the source field still names `deploy` and the last Pages run used that branch. The workflow publishes an artifact directly and does not write to `deploy`.

The intended custom host from CAL-1277 is `https://lsystems.calypsogrammar.com/`. This workflow does not change DNS, configure a custom domain or add a `CNAME`. Confirm and configure that host separately before treating it as the production URL. Cloudways migration remains out of scope.

## Build facts

- `npm run build` (`tsc && vite build`) writes `dist/`. `vite.config.js` sets `base: ''`, so `dist/index.html` uses relative URLs (`./assets/index-<hash>.js`, `./assets/index-<hash>.css`, `./undo.svg`, ...). It works at a domain root and under a sub-path; there are no root-relative (`/assets/...`) URLs in the built HTML. Do not set an absolute `base` without checking this.
- The app makes no network requests besides its own files (`npm run test:browser` aborts and fails on any off-origin request).
- `.gitignore` lists `dist`, but `dist/index.html` and four SVGs are tracked on `main` (force-added earlier), while `dist/assets/` is **not** tracked. Do not publish from a plain checkout of `main`'s `dist/`: `index.html` would point at assets that are not in git. Always rebuild.

## Publish procedure (before the switch only)

This describes the Actions-artifact publishing. After the switch it does not change the live site.

1. Review and merge the release PR into `main`. Merging the workflow change enables automatic publication on this and subsequent pushes to `main`.
2. The `CI` workflow runs the existing typecheck, preset baseline, build, unit tests, browser check and security audit on Node 22 and 26. The Node 22 job uploads a fresh `dist/` Pages artifact; the deployment job waits for **both** matrix jobs to pass. PR runs and manual runs on other branches never deploy.
3. The `deploy` job publishes that artifact using `actions/deploy-pages` with job-scoped Pages and OIDC permissions. The `github-pages` environment records the deployment URL and any configured environment approval rules still apply. Newer runs on the same ref cancel superseded checks/deployments so older runs do not publish after newer ones.
4. Open Actions → CI → the run → `github-pages` to find the published URL. Run the smoke checklist below against that URL and record the source SHA, run URL, date, operator and result in `README.md`.

No manual trigger is normally needed. To retry, use Actions → CI → Run workflow and select `main`; this reruns all checks before publishing. Re-running a `pages-build-deployment` run only republishes its old source and is not the release procedure. Before the switch, do not copy files or push to the `deploy` branch; after the switch, how `deploy` is updated is undecided (see above).

Before the switch: if deployment fails, check Settings → Pages → Build and deployment → Source is **GitHub Actions**, and inspect the `github-pages` environment rules. Branch protection and any required approvals remain in force. CI checks run on pull requests without Pages write or OIDC permissions; those permissions belong only to the deployment job. After the switch, the Source must be the `deploy` branch, not GitHub Actions; do not set it back without the owner's agreement.

HTTPS: Pages issues the certificate once DNS points at GitHub; keep "Enforce HTTPS" enabled and check `curl -sI http://lsystems.calypsogrammar.com/` redirects to `https://`.

Cache invalidation: asset file names are content-hashed, so a new build never reuses an asset URL; only `index.html` (and the unhashed SVGs) can be stale, for up to about 10 minutes on Pages. Verify with a cache-busting request (`curl -sI "https://lsystems.calypsogrammar.com/?x=$(date +%s)"`) and a hard reload. If a CDN or Cloudflare proxy is found in front, purge it after publishing.

## Rollback (before the switch only)

Revert the faulty source change in a pull request against `main` (for a merge commit, use the appropriate mainline parent), review and merge it. The normal CI and Pages deployment sequence publishes the corrected build. Repeat the live smoke checklist and record the rollback source SHA and deployment run in `README.md`. **After the switch** this does not change the live site, because Pages serves `deploy` and the workflow does not write to it; the rollback method for `deploy` is undecided, so ask the owner. Reverting a `deploy` commit has no effect while the source is GitHub Actions.

## Live inspection commands (to complete the open items)

```
dig +short lsystems.calypsogrammar.com CNAME; dig +short lsystems.calypsogrammar.com A
curl -sI https://lsystems.calypsogrammar.com/         # Server, via, x-github-request-id, cache-control, etag
curl -s https://lsystems.calypsogrammar.com/ | grep -o 'assets/[^"]*'   # compare with the local dist/ hashes
curl -sI https://lsystems.calypsogrammar.com/assets/<js file from above> # 200, content-type text/javascript
gh api repos/calypsoGrammar/lsystems/pages              # build_type, html_url, cname, https_enforced, source.branch, source.path (after the switch: legacy, deploy, /, lsystems.calypsogrammar.com)
```
A `Server: GitHub.com` header with `x-github-request-id` confirms Pages; Varnish/nginx/Cloudways headers or an A record to a Cloudways server mean the premise is wrong: stop and ask the owner before changing anything.

## Live smoke checklist (not yet run)

Run in a desktop and a phone-sized (or real mobile) browser with DevTools open; no failed requests, no console errors.

- [ ] Page loads over HTTPS at the canonical host; CSS/JS/icons/SVG load from the published URL (no 404, no root-relative failures).
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
