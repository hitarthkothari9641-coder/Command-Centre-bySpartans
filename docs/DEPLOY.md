# 🚀 Deploying the Command Center on Render

**SPARTANS X TECH BOSS · Big Boss Command Center** is a static bundle served by a
zero-dependency Node server (`server.cjs`). That makes it a perfect Render Web Service —
no database, no secrets, no external services.

Two supported paths:

| Path | Best for | Notes |
|---|---|---|
| **A · Blueprint (`render.yaml`)** | One-click, repeatable | Recommended — health check, caching and env vars are pre-configured |
| **B · Manual Web Service** | If you'd rather click through the UI | Same settings, ~2 minutes |

A **Static Site** also works (Path C) since the app is 100% client-side.

---

## Prerequisites

```bash
git remote -v                 # repo is on GitHub
npm ci && npm test            # 28/28 checks pass locally
npm start                     # http://localhost:5173
```

Merge the feature branch into your default branch (`main`) first — Render deploys from a branch.

---

## Path A · Blueprint deploy (recommended)

1. Push `render.yaml` (already in this repo) to `main`.
2. Render Dashboard → **New +** → **Blueprint**.
3. Pick `Command-Centre-bySpartans` → **Connect**.
4. Render reads `render.yaml`, shows the `bigboss-command-center` service → **Apply**.
5. Wait ~1–2 min for the first build. Your URL appears at the top of the service page:
   `https://bigboss-command-center.onrender.com`

Render automatically:
- runs `npm ci --omit=dev` (runtime needs no dependencies at all — the app is static),
- starts `node server.cjs` with `PORT` injected,
- polls **`/healthz`** for liveness,
- redeploys on every push to `main`.

### What's in the blueprint

| Setting | Value | Why |
|---|---|---|
| `runtime` | `node` | Native Node buildpack, no Docker needed |
| `buildCommand` | `npm ci --omit=dev` | Reproducible install; skips jsdom/esbuild (dev-only) |
| `startCommand` | `node server.cjs` | Binds `0.0.0.0:$PORT` |
| `healthCheckPath` | `/healthz` | Returns JSON `{status:"ok",version,…}` |
| `plan` | `free` | Upgrade to `starter` to avoid cold-start spin-down |
| `region` | `singapore` | Closest to India; change to `oregon`/`frankfurt`/`ohio` |
| `autoDeploy` | `true` | Push to `main` → automatic redeploy |
| `NODE_ENV` | `production` | Log/env flag |
| `NODE_VERSION` | `22.22.0` | Matches the local toolchain |

---

## Path B · Manual Web Service

1. Render Dashboard → **New +** → **Web Service** → connect the repo.
2. Fill in:

   | Field | Value |
   |---|---|
   | Name | `bigboss-command-center` |
   | Region | Singapore (or nearest) |
   | Branch | `main` |
   | Runtime | Node |
   | Build Command | `npm ci --omit=dev` |
   | Start Command | `node server.cjs` |
   | Instance Type | Free |
   | Health Check Path | `/healthz` |

3. **Environment variables** → add `NODE_ENV = production` (optional: `NODE_VERSION = 22.22.0`).
4. **Create Web Service** → watch the log for:

   ```
   🏛️  Big Boss · Command Center v1.0.0 listening on 0.0.0.0:10000
       → https://bigboss-command-center.onrender.com  (env: production, Render)
       → health check: https://bigboss-command-center.onrender.com/healthz
   ```

> `head`/`tests` are not run during deploy. Run `npm test` locally or in CI.

---

## Path C · Static Site (alternative)

The app is fully client-side, so a Render **Static Site** works too:

| Field | Value |
|---|---|
| Build Command | *(leave empty)* |
| Publish Directory | `.` |
| Rewrite Rule | Source `/*` → Destination `/index.html` (type: Rewrite) |

Caveats: no `/healthz`, and `site.webmanifest`/`favicon.ico` are served with Render's own
MIME guesses. The Web Service path handles both correctly and is what `render.yaml` sets up.

---

## Custom domain

Service page → **Settings** → **Custom Domains** → add `commandcenter.yourdomain.com`.
For a subdomain, add the shown `CNAME` record at your DNS provider; Render issues the TLS
certificate automatically. Nothing in the app hard-codes a hostname, so no code changes needed.

---

## Verify a deployment

```bash
BASE=https://bigboss-command-center.onrender.com

curl -s $BASE/healthz                     # {"status":"ok",…}
curl -sI $BASE/site.webmanifest | grep -i content-type   # application/manifest+json
curl -sI $BASE/favicon.ico | grep -i content-type        # image/x-icon
curl -s -o /dev/null -w '%{http_code}\n' $BASE/nope.png  # 404 (never HTML)
curl -s -o /dev/null -w '%{http_code}\n' $BASE/nominations # 200 (SPA fallback)
```

Then in a browser: splash → dashboard; grant immunity → try to nominate → *"Immunity active —
nomination denied"*; make an announcement → cinematic banner; refresh → state restored.

---

## Operations notes

- **State lives in the browser** (`localStorage`, key `bb-command-centre.v1`). Render stores
  nothing; clearing site data resets the House to the demo season. Use **Settings → Export JSON**
  for backups.
- **Cold starts:** the free plan spins down after ~15 min of inactivity; the next request takes
  ~30 s. Upgrade to `starter` for always-on.
- **Cost:** the app is ~1.5 MB of static assets (vendor bundle, fonts, brand art). One instance,
  no database.
- **Scaling:** state is client-side, so you can scale instances freely — every instance serves
  the same static bundle and there is no session affinity to worry about.
- **Caching:** HTML revalidates (`no-cache`), `/vendor/*` and `/assets/*` cache for 7 days with
  `stale-while-revalidate`, everything else for 1 hour. Redeploys bust caches via ETag.
- **Known non-issues in logs:** none expected. If you see `EADDRINUSE`, the platform gave a taken
  port — remove any hard-coded `PORT` env var and let Render inject it.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| Build fails on `npm ci` | `package-lock.json` must be committed (it is). Check the branch you selected. |
| Deploy succeeds, page 502s | Start command must be exactly `node server.cjs`; confirm logs show the listening banner. |
| Health check fails | Path must be `/healthz`; the server answers `200` with JSON. |
| Blank page / old look | Hard-refresh (`Ctrl/Cmd + Shift + R`) — assets cache for 7 days. |
| Icons missing in the browser tab | `favicon.ico` and `assets/icons/*` must be committed; verify with the `curl` checks above. |
| Layout looks unstyled | Confirm the five `styles/*.css` files are in the deployed commit. |
