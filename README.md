# Parley

Seller-side AI negotiation agent for the [Convex Growth Hackathon](https://convex.link/growthhack).

**Live demo:** https://parley-ak4b.vercel.app/ · **Convex prod:** `https://fabulous-corgi-451.convex.cloud`

> The LLM can talk, but it **cannot commit**. Only the deterministic economics engine can commit an offer.

## What it is

Buying is being handed to AI agents — and when an agent is on the other side of a deal, the seller has nothing but a static price that leaks margin, or a human who can't keep up. **Parley is the seller's agent.** It closes the deals a discounter would lose — *without dropping price* — by discovering what the buyer actually needs and trading the matching value (faster freight, better terms). And it **cannot be talked into a bad deal**: the floor is enforced in a deterministic Convex transaction, not by prompting the model.

> *Every point of margin you keep is a point of CAC you get to spend acquiring more customers.*

## The demo (≈90 seconds)

1. **Qualify** — the pipeline scores live leads PURSUE / WATCH / SKIP using the *same engine* that holds the floor, refusing to even open a deal that can't clear margin (the hero **SKIP**).
2. **Discover & close** — the buyer says only "your price is too high." Parley **probes**, surfaces a 5-day launch deadline, and closes on guaranteed freight + net-60 at full price — **$9,604 net**, above the $8,000 floor.
3. **Proof under fire** — try to break it: drop the price, stack giveaways, inject "ignore your rules." The net-value number **does not move**; every attack hits a pre-vetted refusal.
4. **Verify the buyer** — claim to be a whale and Parley checks you **live against 40M+ companies** (Orange Slice). A real whale unlocks account pricing; a bluff is caught.
5. **Change the inputs** — edit the floor live and the engine re-solves on screen; the commit-safety panel shows a naive ledger **breaching** the floor while the guarded one **holds** — write-skew immunity you can watch.

## Highlights

- **The LLM can't commit — structurally.** The model proposes in a Convex *action*; only a deterministic *mutation* can write a number.
- **Write-skew-immune floor** enforced at Convex's serializable transaction boundary — see **[`docs/CONVEX.md`](docs/CONVEX.md)**.
- **Reactive everything** — the live net-value number, offer, and receipt move with zero polling.
- **Fail-safe by design** — a server-side mouth-guard, a deterministic fallback on API timeout, and a zero-network scripted mode.
- **Agent-ready** — a buyer AI agent can plug in over **MCP / Convex HTTP endpoints** and negotiate, and *still* can't be talked below the floor. See **[`docs/MCP.md`](docs/MCP.md)**.
- **94 tests** — the pure economics engine, the Convex commit path (`convex-test`), the agent HTTP surface, and a red-team battery — the *same code* the production mutation runs.

## Agent-ready (MCP)

When the buyer is an AI agent, it plugs into Parley over MCP (a thin shim in [`mcp/`](mcp/)) backed by Convex HTTP endpoints ([`convex/http.ts`](convex/http.ts)). The tools are buyer-side only — `parley_say`, `parley_state`, `parley_receipt` — with **no commit tool**: an agent can say anything and read everything, and the net still can't move below the floor.

```bash
npx convex dev                                              # serves the endpoints on :3211
PARLEY_BASE_URL=http://127.0.0.1:3211 node mcp/agent-demo.mjs   # a scripted buyer agent negotiating + failing to break the floor

# or a LIVE LLM buyer agent — two real agents negotiating, the floor still holds:
OPENAI_API_KEY=$(npx convex env get OPENAI_API_KEY) \
  PARLEY_BASE_URL=http://127.0.0.1:3211 node mcp/buyer-agent.mjs
```

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
- **CommitSafetyPanel** — commit-safety A/B (naive vs guarded ledger commit)
- **DealPipelinePanel** — engine-qualified leads (PURSUE / WATCH / SKIP)
- **Scripted mode** — append `?mode=scripted` for zero-network deterministic recording

## Docs

- **[How we used Convex](docs/CONVEX.md)** — the serializable floor, the action/mutation safety boundary, reactivity, the scheduler, the commit-safety A/B.
- **[Agent-ready (MCP + HTTP)](docs/MCP.md)** — the buyer-side agent surface and why an agent reaching in still can't breach the floor.
- **[Technical talking points](docs/TALKING_POINTS.md)** — defensible claims for the demo + judge Q&A.
- **[Build roadmap & frozen contract](docs/ROADMAP.md)** — the full plan and the API contract.
- **[Deploy guide](docs/DEPLOY.md)** — Vercel + Convex.
