# L-Systems V1 release, deployment and rollback runbook (CAL-1277, LSYS-V1-09)

Status: **live verification pending, owner-controlled blocker open.** Nothing here was deployed, and no live check was made. The agent environment cannot reach `https://lsystems.calypsogrammar.com/` (see `docs/AUDIT.md`), has no hosting credentials, and was not authorised to publish.

## Chosen deployment path

Per the owner's answer on CAL-1277: **GitHub Pages from the deploy branch**, with `https://lsystems.calypsogrammar.com/` as the canonical host. This is the owner's stated route; the agent could not confirm it against the live site. Migration to or from Cloudways, and any DNS change, is out of V1 scope without separate owner approval. V1 completion is not linked to a DNS change.

Facts the owner must confirm during the live check (the repository contains no `CNAME`, Pages workflow or Cloudways config):

| Item | Expected | Confirmed? |
|---|---|---|
| Canonical host | `lsystems.calypsogrammar.com` | no |
| DNS | CNAME to `calypsogrammar.github.io` (or Pages A records) | no |
| Pages source | branch `deploy`, folder `/` (root), custom domain set, "Enforce HTTPS" on | no |
| `CNAME` file | the Pages source root must contain `CNAME` with `lsystems.calypsogrammar.com` if Pages needs it; it is not in `public/`, so add it to the deploy branch (or to `public/` with owner sign-off) | no |
| Caching | GitHub Pages sends `cache-control: max-age=600`; assets are content-hashed | no |

## Build facts

- `npm run build` (`tsc && vite build`) writes `dist/`. `vite.config.js` sets `base: ''`, so `dist/index.html` uses relative URLs (`./assets/index-<hash>.js`, `./assets/index-<hash>.css`, `./undo.svg`, ...). It works at a domain root and under a sub-path; there are no root-relative (`/assets/...`) URLs in the built HTML. Do not set an absolute `base` without checking this.
- The app makes no network requests besides its own files (`npm run test:browser` aborts and fails on any off-origin request).
- `.gitignore` lists `dist`, but `dist/index.html` and four SVGs are tracked on `main` (force-added earlier), while `dist/assets/` is **not** tracked. Do not publish from a plain checkout of `main`'s `dist/`: `index.html` would point at assets that are not in git. Always rebuild.

## Publish procedure (owner or an approved operator)

Requires owner approval for the production publication and write access to the `deploy` branch.

1. Start from the approved commit on `main`: `git fetch && git checkout <release SHA>`; `git status` must be clean. Record `git rev-parse HEAD`.
2. `nvm use` (`.nvmrc`; Node `^20.19.0 || >=22.12.0`), then `npm ci --no-audit --no-fund`.
3. Verify: `npm run check` (typecheck, preset baseline, build, unit tests, browser check, audit). Browser check needs Playwright (header of `scripts/browser-check.mjs`).
4. `npm run build`. Only the contents of `dist/` are published.
5. Prepare the deploy branch in a separate worktree so the source tree is untouched:
   ```
   git worktree add ../lsystems-deploy deploy
   rsync -a --delete --exclude .git --exclude CNAME dist/ ../lsystems-deploy/
   cd ../lsystems-deploy
   # ensure CNAME (lsystems.calypsogrammar.com) and, optionally, an empty .nojekyll are present
   git add -A && git commit -m "Deploy <release SHA>"   # put the full source SHA in the message
   git push origin deploy
   ```
6. Wait for the Pages deployment (repo Actions / Settings > Pages) to finish, then run the smoke checklist below against the live URL.
7. Record the result (date, SHA, who, pass/fail) in the "Release record" section of `README.md`.

HTTPS: Pages issues the certificate once DNS points at GitHub; keep "Enforce HTTPS" enabled and check `curl -sI http://lsystems.calypsogrammar.com/` redirects to `https://`.

Cache invalidation: asset file names are content-hashed, so a new build never reuses an asset URL; only `index.html` (and the unhashed SVGs) can be stale, for up to about 10 minutes on Pages. Verify with a cache-busting request (`curl -sI "https://lsystems.calypsogrammar.com/?x=$(date +%s)"`) and a hard reload. If a CDN or Cloudflare proxy is found in front, purge it after publishing.

## Rollback

Each publication is one commit on `deploy`, so rollback is a revert:

```
git worktree add ../lsystems-deploy deploy && cd ../lsystems-deploy
git revert --no-edit <bad deploy commit>     # or: git reset --hard <last good commit> && git push --force-with-lease (needs owner OK)
git push origin deploy
```

Then repeat the smoke checklist. Record the last known good deploy commit and its source SHA in `README.md` after every publication. If the Pages deployment itself is broken, the owner can re-run it from the Actions tab or temporarily unpublish in Settings > Pages.

## Live inspection commands (to complete the open items)

```
dig +short lsystems.calypsogrammar.com CNAME; dig +short lsystems.calypsogrammar.com A
curl -sI https://lsystems.calypsogrammar.com/         # Server, via, x-github-request-id, cache-control, etag
curl -s https://lsystems.calypsogrammar.com/ | grep -o 'assets/[^"]*'   # compare with the local dist/ hashes
curl -sI https://lsystems.calypsogrammar.com/assets/<js file from above> # 200, content-type text/javascript
gh api repos/calypsoGrammar/lsystems/pages              # source branch/path, cname, https_enforced
git ls-remote origin deploy
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
