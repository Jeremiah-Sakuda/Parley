# Parley

Seller-side AI negotiation agent for the [Convex Growth Hackathon](https://convex.link/growthhack).

**Live demo:** _(deploy URL pending — run `npx convex dev` then connect Vercel)_

> The LLM can talk, but it **cannot commit**. Only the deterministic economics engine can commit an offer.

## Quick start

```bash
npm install
npx convex dev          # logs in, creates deployment, generates convex/_generated
npm run dev             # Vite dev server (or: npm run dev:convex)
```

Set server secrets:

```bash
npx convex env set OPENAI_API_KEY sk-...
```

## Deploy (Vercel)

- **Build command:** `npx convex deploy --cmd 'npm run build'`
- **Output directory:** `dist`
- Add `VITE_CONVEX_URL` from your Convex production deployment in Vercel env vars (or use Convex's Vercel integration).

Optional: set `VITE_SHOW_COMMIT_SAFETY=true` to show the Sprint 6 commit-safety A/B panel.

## Architecture

| Lane | Owner | Scope |
|------|-------|-------|
| `convex/` | Claude | Engine, mutations, actions, tests |
| `src/` | Cursor | React UI, deploy, video |

See [`docs/ROADMAP.md`](docs/ROADMAP.md) for the frozen contract and sprint plan.

## Components

- **BuyerChat** — reactive messages + buyer composer
- **OfferCard** — engine numbers only (never from chat)
- **ControlPanel** — live deal card edits (no apply button)
- **NetValueMeter** — hero net value + floor headroom bar
- **ReceiptCard** — itemized audit trail
- **MouthGuardBadge** — armed / overridden status
- **CommitSafetyPanel** — gated concurrency A/B demo (Sprint 6)
