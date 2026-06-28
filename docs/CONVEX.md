# How Parley uses Convex

Parley's whole thesis — **"the LLM can talk, but it cannot commit; only the deterministic engine can commit an offer"** — is not a slogan we bolted on top of a database. It's a direct expression of Convex's primitives. Convex isn't just where we store data; **its function model and its serializable transactions are the safety architecture.**

This doc explains exactly where and why.

---

## 1. The action / mutation / query split *is* the safety boundary

Convex gives you three kinds of function, and the distinction is load-bearing for Parley:

| Convex primitive | Property | Parley uses it for |
|---|---|---|
| **`query`** | read-only, **reactive**, deterministic | `negotiate.liveState`, `offers.current`, `receipt.get`, `messages.list`, `pipeline.qualifyLeads` — everything the UI subscribes to |
| **`mutation`** | the **only** thing that can write; runs as a **serializable ACID transaction**; no external I/O | `negotiate.commitConcession` (the floor commit), `dealCard.update`, `messages.sendBuyer` |
| **`action`** | for side effects / the outside world; **cannot write the DB directly** | `agent.respond` (OpenAI), `verifyLive.lookup` (Orange Slice), `harness.runRace` |

The key consequence: **the LLM lives in an `action`, and an action cannot write to the database.** To change anything it must call a `mutation`. Our commit mutation, `commitConcession`, takes only a `leverId` — never a price. So *"the LLM cannot commit a number"* isn't enforced by a prompt or a guard we hope holds; it's enforced by Convex's action/mutation boundary. There is no code path for a model-produced number to reach the offer.

```
buyer turn → messages.sendBuyer (mutation) → schedules agent.respond (action)
  agent.respond: OpenAI proposes { leverIds, prose }   ← can talk to the world, cannot write
    → commitConcession (mutation): clamps net ≥ floor, commits  ← only this can write a number
```

---

## 2. The floor is a write-skew-immune invariant at Convex's serializable boundary

This is the centerpiece, and it's the reason "Best use of Convex" fits.

Convex mutations are **ACID, serializable** transactions enforced by **optimistic (multi-version) concurrency control**. Convex tracks each transaction's **read set and write set**; if two transactions touch overlapping data, it aborts the loser and **automatically re-runs it** against fresh state.

`commitConcession` is written so that the floor-determining read and the competing write are the **same document**:

```ts
const head = await ctx.db.get(neg.ledgerId);          // READ the contended head → read set
if (net < head.floorCents) return COUNTER;            // clamp — no write
await ctx.db.insert("concessionEntries", entry);      // immutable ledger entry
await ctx.db.patch(head._id, { appliedCostCents });   // PATCH the same head → write set overlaps
```

Because every concession reads **and** patches the one `negotiationLedger` head doc, two concurrent concessions land in each other's read/write sets. Convex serializes them: one commits, the other gets an OCC conflict and is auto-retried against the updated head, where it re-checks the floor. **Write skew is structurally impossible** — not because Convex magically prevents all anomalies, but because *the invariant's state is the contended document.*

- The immutable `concessionEntries` table is the **auditable source of truth**; `head.appliedCostCents` is a **denormalized running-sum cache** reconciled against it (`tests/ledger.test.ts` asserts the reconciliation, including after a forced retry).
- **Fail-closed:** if retries were ever exhausted under pathological contention, the result is a safe counter — never a breach.

### We prove it live — the commit-safety A/B (`harness.runRace`)

The same engine, two commit strategies, run as real Convex transactions:

- **NAIVE** checks the floor against the head's *stale cached scalar* and writes to a *different* document (inserts an entry, never patches the head). Its read set `{head}` and write set `{entry}` don't overlap → nothing conflicts → every concession passes the stale check → **the floor is breached** (net $6,000 < $8,000 floor).
- **GUARDED** reads-and-patches the one head → Convex's OCC serializes the concurrent commits and the clamp **holds** (net exactly $8,000).

The opponent is concurrency, not a competitor — it's our own engine, two ways. Each mode runs on its own ledger key so the two can run in parallel with zero contamination.

### Defensible phrasing (and the traps to avoid)
- ✅ "Enforced at Convex's **serializable** transaction boundary; write skew is structurally impossible because the floor-read and the competing write are the **same contended document.**"
- ✅ "Convex aborts the loser and **automatically retries** it against fresh state."
- ❌ Not "row locks" (Convex is lock-free OCC), not "snapshot isolation" (it's serializable — stronger), not "infinite retries" (say "automatically retried").

Sources: [docs.convex.dev/database/advanced/occ](https://docs.convex.dev/database/advanced/occ) · [stack.convex.dev/how-convex-works](https://stack.convex.dev/how-convex-works)

---

## 3. Reactivity is the live demo — with zero plumbing

The net-value number climbing on screen, the offer card flashing, the receipt updating, the "manipulation blocked" counter ticking — none of that is polling or websocket code. It's Convex `useQuery` **subscriptions**: when `commitConcession` writes the offer/ledger docs, every query whose result depends on them re-runs and the components re-render.

The **"it's not hardcoded" control-panel demo** falls out of the same property: `dealCard.update` patches the deal card, and `negotiate.liveState` **derives** net from the *live* card — so a judge editing the floor re-solves the meter on the next read with no extra wiring.

---

## 4. The scheduler runs the async agent turn

`messages.sendBuyer` is a mutation that inserts the buyer's message and then `ctx.scheduler.runAfter(0, api.agent.respond, …)`. The seller's reply (LLM → engine → commit → message) runs as a scheduled action and appears reactively. The UI never calls the action directly — it sends a message and watches the transcript update.

> Note: scheduled functions only run while a Convex backend is up — automatic on the cloud deployment; locally you keep `npx convex dev` running.

---

## 5. Pure engine, one code path — Convex + Vitest run the same code

The economics engine (`convex/engine/`) is **pure TypeScript with zero Convex imports**: `solve`, `clamp`, `applyConcession`, lever selection, grounding, the mouth-guard, `qualify`. Because it imports nothing from Convex, the **exact same code** runs in Vitest and inside the production mutation. Our 63 tests therefore exercise the real commit path, not a stand-in. The Convex side is a thin transactional caller around a tested core.

---

## 6. Node actions for the SDKs

Most of Parley runs in Convex's default (V8) runtime, which supports `fetch` — that's how `agent.respond` calls OpenAI. The Orange Slice SDK is a Node package, so the live buyer-verification call lives in a **`"use node"` action** (`verifyLive.lookup`) that bundles the package. It's **fail-open**: no key, an error, or an unparseable result returns `null` and the agent falls back to a deterministic fixtured verifier — the demo never depends on the external call.

---

## 7. Schema, indexes, env

- **8 tables** (`schema.ts`): `dealCards`, `negotiation`, `negotiationLedger` (the contended head), `concessionEntries` (immutable ledger), `messages`, `offers`, `manipulationLog`, `llmCache`. Money is **integer cents** everywhere.
- **Indexes** (`by_negotiation`, `by_scenario`, `by_key`) back every read so subscriptions stay cheap.
- **Secrets** are deployment env vars (`npx convex env set OPENAI_API_KEY …`, `ORANGESLICE_API_KEY …`), read via `process.env` inside actions — never in a query, mutation, document, or the client bundle.

---

## 8. Every Convex function

| Function | Type | Role |
|---|---|---|
| `deals.activeCard` | query | the live (editable) deal card |
| `dealCard.update` | mutation | control-panel edit (dot-path patch) → live re-solve |
| `negotiate.liveState` | query | reactive net-value / status / verify status |
| `negotiate.commitConcession` | mutation | **the floor commit** (contended head, OCC) |
| `negotiate.recordOutcome` / `setVerify` | internal mutation | manipulation log + verify result |
| `offers.current` / `list` | query | the standing offer (engine numbers only) |
| `messages.list` | query | the transcript |
| `messages.sendBuyer` | mutation | buyer turn → schedules the seller turn |
| `messages.appendSeller` | internal mutation | seller turn writer |
| `agent.respond` | action | LLM → engine → commit → message |
| `agent.context` / `cacheGet` / `cachePut` | internal | history + response cache |
| `verifyLive.lookup` | **node action** | live Orange Slice company verification (fail-open) |
| `pipeline.qualifyLeads` | query | top-of-funnel PURSUE/WATCH/SKIP (engine run forward) |
| `pipeline.loadLead` | action | open a lead in the console |
| `harness.runRace` | action | the commit-safety A/B (naive vs guarded) |
| `harnessOps.*` | internal | the two commit strategies + ledger ops |
| `receipt.get` | query | itemized receipt (reconciles to the ledger) |
| `seed.run` / `seed.reset` | mutation | seed + clean demo runs |

---

## Why this is "Best use of Convex"

We didn't use Convex as a CRUD store with a chatbot on top. We used it the way it's designed:

- **Serializability as the correctness mechanism** — the margin floor is a transactional invariant, demonstrably write-skew-immune, and we prove it live.
- **The action/mutation split as the trust boundary** — the non-deterministic model can propose but physically cannot commit.
- **Reactivity as the demo** — the live numbers move with zero polling.
- **The scheduler** for async agent turns, **Node actions** for SDKs, and **pure functions** for a tested production code path.

The deterministic engine governs the whole deal — which to open and how to close — and the model can never commit past your economics. Convex is what makes that guarantee real.
