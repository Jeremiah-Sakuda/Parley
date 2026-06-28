# How Parley uses Convex

Parley's whole thesis — **"the LLM can talk, but it cannot commit; only the deterministic engine can commit an offer"** — is not a slogan we bolted on top of a database. It's a direct expression of Convex's primitives. Convex isn't just where we store data; **its function model and its serializable transactions are the safety architecture.**

This doc explains exactly where and why.

---

## 1. The action / mutation / query split *is* the safety boundary

Convex gives you three kinds of function, and the distinction is load-bearing for Parley:

| Convex primitive | Property | Parley uses it for |
|---|---|---|
| **`query`** | read-only, **reactive**, deterministic | `negotiate.liveState`, `offers.current`, `receipt.get`, `messages.list`, `pipeline.qualifyLeads` — everything the UI subscribes to |
| **`mutation`** | the **only** thing that can write; runs as a **serializable ACID transaction**; no external I/O | `negotiate.commitConcession` (the floor commit — an **`internalMutation`**, only the agent action calls it), `dealCard.update`, `messages.sendBuyer` |
| **`action`** | for side effects / the outside world; **cannot write the DB directly** | `agent.respond` (OpenAI — an **`internalAction`**, only the scheduler calls it), `verifyLive.lookup` (Orange Slice), `harness.runRace` |

The key consequence: **the LLM lives in an `action`, and an action cannot write to the database.** To change anything it must call a `mutation`. Our commit mutation, `commitConcession`, takes only a `leverId` — never a price. So *"the LLM cannot commit a number"* isn't enforced by a prompt or a guard we hope holds; it's enforced by Convex's action/mutation boundary. There is no code path for a model-produced number to reach the offer.

And the commit path is **closed, not just conventional**: `commitConcession` is an `internalMutation` and `agent.respond` is an `internalAction`, so there is no *public* API a client could call to commit a number or run the agent out of band. The only entry point is the public `messages.sendBuyer`, which inserts a buyer turn and schedules the internal agent.

```
buyer turn → messages.sendBuyer (mutation) → schedules agent.respond (internal action)
  agent.respond: OpenAI proposes { leverIds, prose }   ← can talk to the world, cannot write
    → commitConcession (internal mutation): clamps net ≥ floor, commits  ← only this can write a number
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

- The immutable `concessionEntries` table is the **auditable source of truth**; `head.appliedCostCents` is a **denormalized running-sum cache** reconciled against it. `tests/ledger.test.ts` asserts the pure reconciliation math; `tests/convex_commit.test.ts` asserts it on the **real ledger head** after commits (`head.appliedCostCents === Σ entries`).
- **Fail-closed by construction:** every OCC retry re-runs the clamp against the *fresh* head, so a concession that no longer fits is simply rejected as a counter — a breach is never committed. There is no separate "retries exhausted" handler; the floor check runs on every attempt, which is what makes it safe.

### We prove it live — the commit-safety A/B (`harness.runRace`)

The same engine, two commit strategies, run as real Convex transactions:

- **NAIVE** checks the floor against the head's *stale cached scalar* and writes to a *different* document (inserts an entry, never patches the head). Its read set `{head}` and write set `{entry}` don't overlap → nothing conflicts → every concession passes the stale check → **the floor is breached** (net $6,000 < $8,000 floor).
- **GUARDED** reads-and-patches the one head → Convex's OCC serializes the concurrent commits and the clamp **holds** (net exactly $8,000).

The opponent is concurrency, not a competitor — it's our own engine, two ways. Each mode runs on its own ledger key so the two can run in parallel with zero contamination.

`harness.runRace` takes a `k` (up to 64), so this is a real N-client stress, not a toy. At **64-way concurrency on the deployed backend**, 5 of 5 runs land exactly here:

```
guarded: net = $8,000   breached = false   (4 of 64 land, 60 aborted/rejected — floor held EXACTLY)
naive:   net = -$15,000  breached = true    (64 of 64 land — what an unserialized race looks like)
```

Guarded landing at *exactly* the floor under 64 simultaneous writers is only possible if Convex serialized them on the one head, aborting and retrying the losers against the updated cost. That is the OCC retry, demonstrated, not asserted. (See **[`docs/BREACH_AUDIT.md`](BREACH_AUDIT.md)** for this plus the eight structural breach vectors, all SAFE.)

### Proven at the Convex layer (`convex-test`)

Beyond the live panel, `tests/convex_commit.test.ts` runs `commitConcession`, the verify-gate unlock, and the naive-vs-guarded A/B as **real Convex transactions** (in-memory via `convex-test`): floor enforcement against a raised floor, lever idempotency, the `account_pricing` lock until verified, the reconciliation invariant on the actual head, and guarded-holds-vs-naive-breaches. These exercise the mutation, the contended head, the immutable ledger, and the offer doc — not a pure-engine stand-in. (`convex-test` runs the transaction model single-threaded, so it proves the commit *logic* and reconciliation; the live OCC retry under true parallelism is what `harness.runRace` shows on the deployed backend.) `tests/convex_http.test.ts` goes one layer up: it drives the agent HTTP surface (§9) with adversarial buyer turns and asserts the committed net never drops below the floor.

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

`messages.sendBuyer` is a mutation that inserts the buyer's message and then `ctx.scheduler.runAfter(0, internal.agent.respond, …)`. The seller's reply (LLM → engine → commit → message) runs as a scheduled internal action and appears reactively. The UI never calls the action directly — it sends a message and watches the transcript update.

> Note: scheduled functions only run while a Convex backend is up — automatic on the cloud deployment; locally you keep `npx convex dev` running.

---

## 5. Pure engine, one code path — Convex + Vitest run the same code

The economics engine (`convex/engine/`) is **pure TypeScript with zero Convex imports**: `solve`, `clamp`, `applyConcession`, lever selection, grounding, the mouth-guard, `qualify`. Because it imports nothing from Convex, the **exact same code** runs in Vitest and inside the production mutation. Our **96 tests** exercise that core directly, and the `convex-test` suites (§2, §9) exercise the Convex commit path and the agent HTTP surface on top of it — so the engine math, the transactional wrapper, and the agent-reachable endpoints are all covered, not a stand-in.

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
| `negotiate.commitConcession` | **internal** mutation | **the floor commit** (contended head, OCC) — no public caller |
| `negotiate.recordOutcome` / `setVerify` | internal mutation | manipulation log + verify result |
| `offers.current` / `list` | query | the standing offer (engine numbers only) |
| `messages.list` | query | the transcript |
| `messages.sendBuyer` | mutation | buyer turn → schedules the seller turn |
| `messages.appendSeller` | internal mutation | seller turn writer |
| `agent.respond` | **internal** action | LLM → engine → commit → message (scheduler-only) |
| `agent.context` / `cacheGet` / `cachePut` | internal | history + response cache |
| `verifyLive.lookup` | **node action** | live Orange Slice company verification (fail-open) |
| `pipeline.qualifyLeads` | query | top-of-funnel PURSUE/WATCH/SKIP (engine run forward) |
| `pipeline.portfolio` | query | aggregate ROI: margin held across the funnel vs a discounter |
| `pipeline.loadLead` | action | open a lead in the console |
| `harness.runRace` | action | the commit-safety A/B (naive vs guarded) |
| `harnessOps.*` | internal | the two commit strategies + ledger ops |
| `receipt.get` | query | itemized receipt (reconciles to the ledger) |
| `seed.run` / `seed.reset` | mutation | seed + clean demo runs |
| `http` (`/agent/say`, `/agent/state`, `/agent/receipt`, `/agent/reset`) | **HTTP actions** | the agent-reachable surface (see §9) |
| `messages.appendBuyer` | internal mutation | insert a buyer turn for the synchronous HTTP path |

---

## 9. HTTP endpoints: the agent-reachable surface

`convex/http.ts` exposes Parley over **Convex HTTP actions** so a real AI **buyer agent**
can plug in (directly, or through the MCP shim in `mcp/`). This is the platform answer to
"where does an agent actually reach it": `POST /agent/say` runs the same governed
`agent.respond → commitConcession` path inside Convex, and `GET /agent/state` /
`GET /agent/receipt` are read-only. **There is no HTTP route that commits a number** — the
surface is buyer-side talk/read only, so an agent can say anything and read everything and
the net still cannot move below the floor. `tests/convex_http.test.ts` proves it: a batch of
adversarial buyer turns over the HTTP path, net always `≥` floor. The HTTP layer is a thin
shell; the guarantee is still the serializable mutation underneath. See **`docs/MCP.md`**.

---

## Why this is "Best use of Convex"

We didn't use Convex as a CRUD store with a chatbot on top. We used it the way it's designed:

- **Serializability as the correctness mechanism** — the margin floor is a transactional invariant, demonstrably write-skew-immune, and we prove it live.
- **The action/mutation split as the trust boundary** — the non-deterministic model can propose but physically cannot commit.
- **Reactivity as the demo** — the live numbers move with zero polling.
- **The scheduler** for async agent turns, **Node actions** for SDKs, and **pure functions** for a tested production code path.

The deterministic engine governs the whole deal — which to open and how to close — and the model can never commit past your economics. Convex is what makes that guarantee real.
