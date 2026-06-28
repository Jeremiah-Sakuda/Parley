# Deploy — Vercel + Convex

Convex prod: **https://fabulous-corgi-451.convex.cloud**

## Current Vercel config (Option B — active)

`vercel.json` uses **`npm run build`** only. You already have **`VITE_CONVEX_URL`** on Vercel — that’s enough for the frontend.

**Push backend separately** after `convex/` changes:

```bash
npx convex deploy          # answer Y
npx convex env set OPENAI_API_KEY sk-... --prod   # if needed
npx convex run seed:reset --prod                  # optional demo reset
```

`CONVEX_DEPLOY_KEY` on Vercel is **not used** with this config. You can leave it (harmless) or remove it.

---

## Why integrated deploy failed (Option A)

| Check | Result |
|-------|--------|
| Frontend `npm run build` | ✅ passes locally |
| Convex typecheck / local deploy | ✅ passes |
| Vercel `npx convex deploy --cmd 'npm run build'` | ❌ **dies at `convex deploy`** — CLI reports no deploy config |

Even with `CONVEX_DEPLOY_KEY` visible in the Vercel UI, the build log showed:

```text
✖ Vercel build environment detected but no Convex deployment configuration found.
Set one of: CONVEX_DEPLOY_KEY ...
```

Common causes when the var “looks set” but build fails:

1. **Empty sensitive value** — re-paste the key (no quotes, no trailing spaces)
2. **Wrong key type** — Production builds need a **Production** deploy key from Convex (not Preview)
3. **Same name, both envs** — Convex recommends **separate** keys: Production-only prod key, Preview-only preview key ([docs](https://docs.convex.dev/production/hosting/vercel))
4. **Deploy ran before save** — Redeploy after editing env vars

To retry Option A later: set `buildCommand` back to `npx convex deploy --cmd 'npm run build'`, fix the key, remove manual `VITE_CONVEX_URL` (deploy injects it).

---

## Do this now (~5 min)

### 1. Push this fix to `main`

Commit the `vercel.json` change and redeploy (or push → auto-deploy).

### 2. Push backend to prod from your machine

```bash
npx convex deploy          # answer Y — pushes current convex/ to prod
npx convex run seed:reset --prod   # optional: clean n1 for demo
```

Confirm **`VITE_CONVEX_URL`** on Vercel = `https://fabulous-corgi-451.convex.cloud` (Production + Preview).

---

## Option A — Integrated deploy (optional)

Use this if you want Vercel to auto-push `convex/` on every deploy. Change `vercel.json` back to:

```json
"buildCommand": "npx convex deploy --cmd 'npm run build'"
```

1. Open [Convex → Parley → Production](https://dashboard.convex.dev/t/jeremiahsomoine/parley)
2. **Settings → Deploy Key → Generate Production Deploy Key**
3. Copy the key (starts with something like `prod:...`)

### 2. Vercel project settings

| Field | Value |
|-------|--------|
| **Framework Preset** | Vite |
| **Root Directory** | `./` (leave blank / default) |
| **Build Command** | `npx convex deploy --cmd 'npm run build'` |
| **Output Directory** | `dist` |
| **Install Command** | `npm install` (default) |

### 3. Vercel environment variables

| Key | Value | Environments |
|-----|--------|--------------|
| `CONVEX_DEPLOY_KEY` | _(paste deploy key from step 1)_ | **Production only** |

Do **not** manually set `VITE_CONVEX_URL` for this path — `convex deploy` injects it during the build.

### 4. Prod secrets (one-time, from your machine)

```bash
npx convex env set OPENAI_API_KEY sk-... --prod
```

### 5. Redeploy

Vercel → Deployments → **Redeploy** (or push to `main`).

---

## Option B reference (same as active config above)

| Field | Value |
|-------|--------|
| **Build Command** | `npm run build` |
| **Output Directory** | `dist` |

| Key | Value | Environments |
|-----|--------|--------------|
| `VITE_CONVEX_URL` | `https://fabulous-corgi-451.convex.cloud` | Production, Preview, Development |

Trade-off: frontend deploys won't auto-push Convex function changes — run `npx convex deploy` locally when Claude updates `convex/`.

---

## After deploy

Paste the `*.vercel.app` URL into:

- `README.md` (Live demo line) — **https://parley-ak4b.vercel.app/**
- `docs/PROGRESS.md` snapshot
- Hackathon submission
