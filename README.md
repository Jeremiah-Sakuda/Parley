# Parley

Seller-side AI negotiation agent for the [Convex Growth Hackathon](https://convex.link/growthhack).

**Live demo:** https://parley-ak4b.vercel.app/ · **Convex prod:** `https://fabulous-corgi-451.convex.cloud`

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

**Convex production URL:** `https://fabulous-corgi-451.convex.cloud`

Full step-by-step (including why the first build failed): **[`docs/DEPLOY.md`](docs/DEPLOY.md)**

**TL;DR — pick one:**

| Path | Build command | Vercel env var |
|------|---------------|----------------|
| **A (integrated)** | `npx convex deploy --cmd 'npm run build'` | `CONVEX_DEPLOY_KEY` from Convex dashboard |
| **B (quick)** | `npm run build` | `VITE_CONVEX_URL` = `https://fabulous-corgi-451.convex.cloud` |

Also run once locally: `npx convex env set OPENAI_API_KEY sk-... --prod`

**After first deploy — seed prod** (creates `n1`, deal cards, and the standing offer row):

```bash
npx convex run seed:run --prod
```

Without seed, the live site shows: meter at **$10,000** (list total, no concessions), **Offer card empty**, receipt still on the Sprint 0 fixture ($9,604). After seed, offer card and meter align at $10,000 until concessions commit.

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
