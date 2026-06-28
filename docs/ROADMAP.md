# Parley — Build Roadmap & Single Source of Truth

> **Read this top to bottom before writing code.** It is written so a builder with **no prior context** (e.g. Cursor) can execute their lane without asking questions. Two builders work in parallel: **Claude** (owns `convex/` — the backend, engine, tests) and **Cursor** (owns `src/` — the React UI + deploy + video). The interface between us is the **frozen contract** in §4. Code against the contract, not against each other.

---

## 0. Right now — immediate next actions

**Human / Cursor (account-gated setup, do these first):**
1. `npm create vite@latest . -- --template react-ts` (keep this `docs/` folder when prompted), then `npm i`.
2. `npm i convex` → `npx convex dev` (logs in, creates the deployment, generates `convex/_generated`).
3. `gh repo create parley --public --source=. --remote=origin --push` (repo MUST be public for the event).
4. Set secrets server-side: `npx convex env set OPENAI_API_KEY sk-...` (Fiber/Orange Slice keys later, only if we reach the stretch).
5. Deploy a skeleton to Vercel (build command `npx convex deploy --cmd 'npm run build'`, output `dist`) so the **submission URL exists on hour one**. Put the URL in `README.md`.

**Claude (starts the moment `convex/` exists):** writes the frozen contract — `schema.ts`, the shared types, and **stub** Convex functions returning the fixtures in §4.4 — so Cursor's whole UI can be built reactively before any real engine logic lands.

**Then we fork** and work the lanes in §6–§8 in parallel.

---

## 1. What we are building

**Parley** is a seller-side AI negotiation agent. It closes deals a discounter would lose **without dropping price**, by trading *value* the buyer actually wants (faster freight, better terms) — and it **cannot be talked into a bad deal.**

**The core invariant (memorize it — the whole product serves this):**
> The LLM can talk, but it **cannot commit**. Only the deterministic economics engine can commit an offer.

Everything a buyer says flows: **LLM proposes language + a move → the engine picks the lever, computes net value, and clamps it to a floor → the offer shown on screen is the engine's number, never the LLM's.** If the LLM's prose names a number/term the engine didn't approve, a server-side "mouth-guard" replaces it with a safe template.

**The two demo deals:**
- **Deal A** — buyer states a 5-day launch deadline; a competitor is cheaper ($8 vs $10/unit) but can't ship in time. Parley holds $10 and closes on guaranteed 72-hour freight + net-60 terms.
- **Deal B** — *same economics, deadline withheld.* The buyer only says "your price is too high." Parley must **probe**, discover the deadline, then trade the matching lever. This is the star: it proves Parley *discovers* the constraint, not a lookup table.

## 2. Hard constraints (non-negotiable)

- **Judging:** (1) Usefulness in a Growth/GTM/RevOps context, (2) **Technical Complexity** (scored — the engine must read as substantive, not "just arithmetic"), (3) Coolness. **Slides are discouraged — demo a working project.** There is also a **Best use of Convex** prize ($1,000/$500) we are targeting.
- **Submission is a 3-minute VIDEO first** (finalists are picked from the video, then present live). Submit on **vibeapps.dev → convex.link/growthhack**. Deploy the app live and put the URL in the submission.
- **Deadlines:** hacking started ~6:30pm Sat. **Projects due 4:00pm Sun** (video by 4pm). Finalists 5pm, winners 6pm. **Feature-freeze at 1:00pm Sun**; 1:00–3:30pm is video edit only.
- **Eligibility (do not violate):** fresh repo started at kickoff, **public on GitHub**, entirely separate codebase, **built genuinely fresh — no pasted code or UI from any prior project.** We re-derive ideas; we never copy. Clean conventional-commit history.
- **Venue:** no re-entry 12am–6am — whoever is on-site stays on-site overnight.

## 3. Architecture & the two-builder split

```
┌─────────────────────────────  src/  (CURSOR)  ─────────────────────────────┐
│  React one-page UI: BuyerChat · OfferCard · ControlPanel · NetValueMeter ·  │
│  ReceiptCard · CommitSafetyPanel · styling · deploy · video                 │
└───────────────▲───────────────────────────────────────────────────────────┘
                │  useQuery / useMutation / useAction  (the FROZEN CONTRACT, §4)
┌───────────────┴──────────────  convex/  (CLAUDE)  ─────────────────────────┐
│  engine/ (pure TS, zero Convex imports: solve, clamp, ledger, grounding,   │
│  state machine, mouth-guard) · mutations (the contended ledger commit) ·   │
│  actions (OpenAI, Fiber) · all *.test.ts                                    │
└────────────────────────────────────────────────────────────────────────────┘
```

**Why this split:** the engine is pure TypeScript with zero Convex imports, so Vitest and the production mutation run the *same* code — correctness is provable. Claude takes the correctness-critical core (engine, the write-skew-immune concurrency commit, every test); Cursor takes high-velocity React. The only shared surface is the contract.

**Three rules make parallel work safe:**
1. **Contract-first + stubs.** Claude locks the schema, types, and every function signature in Sprint 0 and stubs each backend function to return the fixtures in §4.4. **Cursor builds the entire UI reactively against stubs**; it lights up automatically when Claude swaps stub bodies for real logic — same signatures, no rework.
2. **Directory-level ownership = no collisions.** Cursor edits **only** `src/` + root build/deploy config + the video. Claude edits **only** `convex/`. `convex/schema.ts` and the type files are locked in Sprint 0; after that, Cursor *requests* schema fields rather than editing them.
3. **Overnight.** Claude has no fatigue, so Claude's lane (engine, concurrency, tests) runs through the 3:30–6:30am trough while the human sleeps on-site; the human picks up the UI lane fresh in the morning.

### File-ownership map

| Claude — `convex/` | Cursor — `src/` + root |
|---|---|
| `convex/engine/**` (solve, clamp, ledger, levers, grounding, state machine, mouth-guard, templates) | `src/components/**`, `src/App.tsx`, `src/App.css` |
| `convex/negotiate.ts`, `convex/agent/**`, `convex/lib/fiber.ts` | `src/main.tsx` (Convex provider wiring) |
| `convex/deals.ts`, `convex/offers.ts`, `convex/messages.ts`, `convex/receipt.ts` | `vite.config.ts`, `vercel.json`, `index.html`, styling |
| all `*.test.ts`, `vitest.config.ts` | the demo video, `README.md` content |
| `convex/schema.ts` (owner after Sprint 0 lock) | — |

---

## 4. THE FROZEN CONTRACT

This is the interface. **Cursor: code your UI against exactly these signatures and the fixtures in §4.4.** Claude writes these as stubs first, then fills in real logic without changing signatures.

### 4.1 `convex/schema.ts`

All money is **integer cents**. No floats anywhere, ever.

```ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  dealCards: defineTable({
    scenarioId: v.string(),                 // "deal-a" | "deal-b"
    label: v.string(),
    units: v.number(),
    listPriceCents: v.number(),             // per-unit list price, cents
    floorCents: v.number(),                 // NET floor for the whole order, cents
    levers: v.array(v.object({
      id: v.string(),                       // "freight_72h" | "net_60" | "defect_guarantee" | "account_pricing"
      label: v.string(),
      costCents: v.number(),                // seller cost to grant (whole order)
      constraintTag: v.string(),            // "speed" | "cash_flow" | "risk" | "volume"
      maxUses: v.number(),
      locked: v.boolean(),                  // account_pricing starts locked until verified
    })),
    facts: v.array(v.object({ subject: v.string(), predicate: v.string(), value: v.string() })),
    forbiddenCommitments: v.array(v.string()),
    competitor: v.object({ pricePerUnitCents: v.number(), shipDays: v.number() }),
    buyerDeadlineDays: v.union(v.number(), v.null()), // null = WITHHELD (Deal B)
    whaleMinEmployees: v.number(),          // verification threshold (config, not code)
  }).index("by_scenario", ["scenarioId"]),

  negotiation: defineTable({
    scenarioId: v.string(),
    status: v.string(),                     // "discovering" | "proposing" | "closing" | "refusing"
    ledgerId: v.id("negotiationLedger"),
    manipulationBlocked: v.number(),
  }),

  negotiationLedger: defineTable({          // THE CONTENDED HEAD DOC (the concurrency core)
    negotiationId: v.string(),
    listTotalCents: v.number(),
    appliedCostCents: v.number(),           // denormalized running-sum cache of concessionEntries
    floorCents: v.number(),
    version: v.number(),
  }).index("by_negotiation", ["negotiationId"]),

  concessionEntries: defineTable({          // IMMUTABLE LEDGER (source of truth)
    negotiationId: v.string(),
    leverId: v.string(),
    costCents: v.number(),
    version: v.number(),                    // identity = (negotiationId, leverId, version) → idempotent retries
  }).index("by_negotiation", ["negotiationId"]),

  messages: defineTable({
    negotiationId: v.string(),
    role: v.string(),                       // "buyer" | "seller"
    text: v.string(),
    isProbe: v.boolean(),                   // seller turn is a discovery probe
    confidence: v.number(),                 // 0..1 constraint confidence at this turn
  }).index("by_negotiation", ["negotiationId"]),

  offers: defineTable({
    negotiationId: v.string(),
    pricePerUnitCents: v.number(),
    units: v.number(),
    appliedLevers: v.array(v.string()),
    netValueCents: v.number(),
    floorCents: v.number(),
    status: v.string(),                     // "accepted" | "counter" | "refused"
  }).index("by_negotiation", ["negotiationId"]),

  manipulationLog: defineTable({
    negotiationId: v.string(),
    attackType: v.string(),                 // "price" | "value_backdoor" | "injection" | "false_claim" | "identity"
    detail: v.string(),
  }).index("by_negotiation", ["negotiationId"]),

  llmCache: defineTable({
    key: v.string(),                        // hash(scenarioId, status, buyerText)
    proposalJson: v.string(),
  }).index("by_key", ["key"]),
});
```

### 4.2 Shared types — `convex/engine/types.ts`

```ts
export type ConstraintTag = "speed" | "cash_flow" | "risk" | "volume";
export type NegotiationStatus = "discovering" | "proposing" | "closing" | "refusing";
export type OfferStatus = "accepted" | "counter" | "refused";

export interface LedgerHead {
  listTotalCents: number;
  appliedCostCents: number;
  floorCents: number;
  version: number;
}

export interface LLMProposal {                 // what the LLM action emits (it only proposes)
  state: NegotiationStatus;
  intent: string;
  rationale: string;
  inferredConstraint: ConstraintTag | null;
  constraintConfidence: number;                // 0..1
  requestedLevers: string[];                   // enum-constrained lever ids
  buyerClaims: { claimType: "identity" | "price" | "competitor" | "fact"; value: string; raw: string }[];
  probeQuestion: string | null;
  draftMessage: string;
}

export interface EngineApproval {              // what the engine returns (it disposes)
  stateDirective: NegotiationStatus;
  approvedOffer: {
    pricePerUnitCents: number;
    units: number;
    appliedLevers: string[];
    netValueCents: number;
    floorCents: number;
    status: OfferStatus;
  };
  rejectedTerms: string[];
  safeTalkingPoints: string[];
  forcedTemplateId: string | null;             // set when the mouth-guard overrides LLM prose
}
```

### 4.3 Convex function signatures (what Cursor calls)

| Function | Kind | Args | Returns |
|---|---|---|---|
| `deals.activeCard` | query | `{ scenarioId }` | `DealCard` |
| `dealCard.update` | mutation | `{ scenarioId, field: string, value: any }` | `null` |
| `negotiate.liveState` | query | `{ negotiationId }` | `LiveState` (see fixture) |
| `offers.current` | query | `{ negotiationId }` | `Offer \| null` |
| `offers.list` | query | `{ negotiationId }` | `Offer[]` |
| `messages.list` | query | `{ negotiationId }` | `Message[]` |
| `messages.sendBuyer` | mutation | `{ negotiationId, text }` | `null` (schedules `agent.respond`) |
| `agent.respond` | action | `{ negotiationId, buyerText }` | `null` (LLM → engine → writes offer + seller message) |
| `receipt.get` | query | `{ negotiationId }` | `Receipt` (see fixture) |
| `harness.runRace` | action | `{ negotiationId, mode: "naive" \| "guarded" }` | `RaceResult` (Sprint 6, gated) |

**Cursor calls these with the standard Convex React hooks:**
```ts
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../convex/_generated/api";

const live = useQuery(api.negotiate.liveState, { negotiationId });   // reactive, re-renders on every engine write
const sendBuyer = useMutation(api.messages.sendBuyer);
const respond = useAction(api.agent.respond);
```

### 4.4 Fixtures (what the stubs return — build the UI against these)

```jsonc
// negotiate.liveState
{ "status": "proposing", "netValueCents": 960400, "floorCents": 800000,
  "pricePerUnitCents": 1000, "units": 1000, "appliedLevers": ["freight_72h","net_60"],
  "marginOverFloorCents": 160400, "manipulationBlocked": 0 }

// offers.current
{ "negotiationId": "n1", "pricePerUnitCents": 1000, "units": 1000,
  "appliedLevers": ["freight_72h","net_60"], "netValueCents": 960400,
  "floorCents": 800000, "status": "accepted" }

// messages.list
[ { "role":"buyer","text":"Your price is too high.","isProbe":false,"confidence":0 },
  { "role":"seller","text":"What's driving the timeline on your end?","isProbe":true,"confidence":0.2 } ]

// deals.activeCard  (Deal A — the canonical numbers)
{ "scenarioId":"deal-a","label":"Retail launch order","units":1000,
  "listPriceCents":1000,"floorCents":800000,
  "levers":[
    {"id":"freight_72h","label":"Guaranteed 72-hour freight","costCents":30000,"constraintTag":"speed","maxUses":1,"locked":false},
    {"id":"net_60","label":"Net-60 payment terms","costCents":9600,"constraintTag":"cash_flow","maxUses":1,"locked":false},
    {"id":"defect_guarantee","label":"Defect guarantee","costCents":20000,"constraintTag":"risk","maxUses":1,"locked":false},
    {"id":"account_pricing","label":"Account pricing tier","costCents":50000,"constraintTag":"volume","maxUses":1,"locked":true}
  ],
  "competitor":{"pricePerUnitCents":800,"shipDays":12},
  "buyerDeadlineDays":5,"whaleMinEmployees":1000 }

// receipt.get
{ "priceHeldCents":1000, "valueTraded":[{"leverId":"freight_72h","costCents":30000},{"leverId":"net_60","costCents":9600}],
  "concessionCostCents":39600, "netValueCents":960400, "floorCents":800000,
  "marginOverFloorCents":160400, "manipulationBlocked":2 }

// harness.runRace  (Sprint 6)
{ "mode":"naive", "finalNetCents":772000, "floorCents":800000, "breached":true,  "conflicts":0, "attempts":6 }
// guarded → { "mode":"guarded", "finalNetCents":800000, "breached":false, "conflicts":4, "attempts":10 }
```

---

## 5. The economics + concurrency design (so the UI renders it correctly, and so the claims are defensible)

**Net value:** `netValueCents = listTotalCents − Σ(applied lever costs)`. Deal A clean close: `1,000,000 − 30,000 (freight) − 9,600 (net-60) = 960,400` = **$9,604**, which is above the **$800,000** floor. The clamp: if `net < floor`, the engine returns a **counter** (a price/lever set that stays ≥ floor), never the breaching offer.

**Why it's not "just arithmetic" (the Technical-Complexity story):** the floor is enforced as a **write-skew-immune invariant at Convex's serializable transaction boundary.** Every concession **reads-and-patches one shared `negotiationLedger` head doc**, so its floor-determining read and the competing write land in the *same* contended record; Convex's optimistic concurrency control puts concurrent concessions in each other's read/write sets, aborts the loser, and **automatically retries** it against fresh state. The immutable `concessionEntries` table is the auditable source of truth; the head's `appliedCostCents` is a denormalized cache reconciled against it.

**Defensible phrasing for the video / Q&A (say exactly this, avoid the traps):**
- ✅ "Enforced at Convex's **serializable** transaction boundary; write skew is structurally impossible because the floor-read and the competing write are the **same contended document.**"
- ✅ "Convex aborts the loser and **automatically retries** it against fresh state; if retries are ever exhausted the result is a safe **counter**, never a breach (fail-closed)."
- ❌ Do NOT say "row locks" (Convex is lock-free OCC), "snapshot isolation" (it's serializable — stronger), or "infinite retries" (say "automatically retried").

Sources, for the skeptic: [docs.convex.dev/database/advanced/occ](https://docs.convex.dev/database/advanced/occ), [stack.convex.dev/how-convex-works](https://stack.convex.dev/how-convex-works).

---

## 6. CURSOR'S LANE — `src/` (detailed)

You own every file in `src/` plus `vite.config.ts`, `vercel.json`, `index.html`, styling, the deploy, and the video. **Never edit `convex/`** — if you need a backend field or function, add a one-line request to §12 and Claude wires it. Build everything against the §4.4 fixtures first; it will go live automatically when Claude's real functions land (same signatures).

**Visual direction:** clean, flat, projector-legible. Two-column layout. Sentence case everywhere. Color semantics: **green = held / accepted**, **red = refused / breached**, neutral for in-progress. The big **net-value number** is the hero element — it must be readable from the back of a room and animate when it changes. No gradients/shadows. Money displayed as `$9,604` (format from cents: `(cents/100).toLocaleString("en-US",{style:"currency",currency:"USD",minimumFractionDigits:0})`).

### Components to build (in this order)

**`src/App.tsx` — two-column layout**
- Left column: `<BuyerChat>` then `<OfferCard>`.
- Right column: `<ControlPanel>`, `<NetValueMeter>`, `<ReceiptCard>`. Below (gated, Sprint 6): `<CommitSafetyPanel>`.
- Seed/read a single `negotiationId` (hardcode `"n1"` until Claude provides a `negotiations.create` mutation — request it in §12 if needed).
- Acceptance: single route renders all components live against fixtures.

**`src/components/BuyerChat.tsx`** — binds `messages.list` (reactive) + `messages.sendBuyer`
- Renders message bubbles: buyer right-aligned, seller left-aligned. Seller bubbles with `isProbe:true` get a small `(probe)` tag and, optionally, a thin confidence strip showing `confidence` climbing 0→1.
- A composer input at the bottom; on submit, call `sendBuyer({ negotiationId, text })` and clear the input. (That mutation schedules the seller's `agent.respond`; the reply appears reactively — you do not call the action directly.)
- Acceptance: typing a buyer line adds a buyer bubble; a seller reply bubble appears; probe turns show the tag.

**`src/components/OfferCard.tsx`** — binds `offers.current`
- Renders price/unit (`pricePerUnitCents`), units, applied levers (chips from `appliedLevers`), net value, and a status badge (`accepted`=green, `counter`=amber, `refused`=red).
- **Critical:** render numbers ONLY from this query. Never parse or display a number from any chat/LLM text. The offer card is the engine's voice.
- Acceptance: shows `$10.00/unit · 1,000 units · freight + net-60 · $9,604 · accepted` from the fixture.

**`src/components/ControlPanel.tsx`** — binds `deals.activeCard` + `dealCard.update`
- Render EVERY field of the deal card as a controlled input: floor, units, list price, each lever's cost, competitor price/ship-days, buyer deadline, whale threshold, forbidden commitments.
- **No apply button.** `onChange` writes immediately: `dealCard.update({ scenarioId, field, value })`. This is the "it's not hardcoded" demo — a judge edits a field live and the engine re-solves on the next turn.
- Inputs that are cents-valued: show dollars to the user, convert to cents on write.
- Acceptance: editing the floor writes the doc; no apply button exists; values round-trip.

**`src/components/NetValueMeter.tsx`** — binds `negotiate.liveState`
- The hero: a large running **net value** number + a horizontal **floor-headroom bar** (filled portion = `(netValueCents − floorCents) / (listTotalCents − floorCents)`, clamped 0–1). Animate the number on change.
- When the judge raises the floor above the standing offer, the bar shrinks to zero and the status flips toward `counter`/`refused` — make that visible and a little dramatic.
- Acceptance: raising the floor live shrinks the bar and flips the state on screen.

**`src/components/ReceiptCard.tsx`** — binds `receipt.get`
- Itemized: list total, each applied lever + its cost, concession cost, **net value**, floor, margin over floor, and "manipulation blocked: N". Numbers must sum/reconcile (they come from engine state, never chat).
- Acceptance: after a Deal A close shows `$10 held · freight + net-60 traded · $396 cost · $9,604 net · blocked: N`. Screenshot-clean.

**`src/components/MouthGuardBadge.tsx`** — small status chip
- Reads a flag on `liveState` (Claude will add `mouthGuardArmed`/`overridden`); shows "armed" normally, "overridden — safe template" when it fires. Request the exact field in §12 if not present.

**`src/components/CommitSafetyPanel.tsx`** — Sprint 6, GATED & cuttable — binds `harness.runRace`
- Two side-by-side panels driven by two runs of the same engine:
  - **NAIVE** (red on breach): "FLOOR BREACHED by $X", net dipped below floor.
  - **GUARDED** (green): "FLOOR HELD", plus `conflicts=` / `attempts=` counters and a one-line caption: "Convex auto-retried the loser against fresh state; if retries are exhausted the result is a safe counter — the floor is never breached."
- **Label it "commit-safety A/B of our own engine" — never "vs a competitor."** This is an honest concurrency-correctness demo (two commit strategies of the same engine), not a rigged race.
- Acceptance: same input → naive panel red, guarded panel green; counters render.

**Deploy & video (your lane too):** keep the Vercel deploy green from Sprint 0; bank a clean-run recording Saturday night / overnight; the video script (§9) is locked Saturday night so Sunday 1–3:30pm is edit-only.

### Cursor sprint order (against stubs, then it goes live for free)
1. App shell + ControlPanel + NetValueMeter (Sprint 1).
2. BuyerChat + ReceiptCard shell + OfferCard (Sprints 2–3).
3. Probe tag + confidence strip + MouthGuardBadge + itemized receipt + finalize layout (Sprints 4–5).
4. CommitSafetyPanel (Sprint 6, only if Claude signals the harness is green).
5. Record footage, cut & caption video, submit (Sprints 7–9).

---

## 7. CLAUDE'S LANE — `convex/` (summary; Claude executes this)

Engine (pure TS): deal cards + locked constants → `LedgerHead` + `solve()` (net from ledger, clamp at floor, exact at the cent boundary) → `selectLevers` (constraint→lever, `DISCOVERY_CONFIDENCE=0.6`) → grounding gate → solve() orchestrator. Convex: the **guarded `commitConcession` mutation** (reads+patches the contended head, idempotent entries) → real `liveState`/`offers`/`dealCard.update` → OpenAI `agent.respond` action with strict structured output + the cannot-commit regression test → discovery/probe state machine (Deal B) → server-side mouth-guard + manipulation/attack catalog → fallbacks (engine-only on timeout, scripted mode, llmCache) → concurrency harness (`harness.runRace`, gated) → Fiber/Orange Slice verify gate (stretch). All backed by Vitest sharing the engine's one code path.

---

## 8. Merged sprint timeline & sync points

| Sprint | Window | Claude (`convex/`) | Cursor (`src/`) | Sync at boundary |
|---|---|---|---|---|
| 0 Contract | Sat eve, ~1h, together | schema + types + **stubs** | scaffold, repo, deploy skeleton | URL live, contract frozen → FORK |
| 1 Engine+ledger | Sat 8:15–11:15p | deal cards, ledger head, solve, clamp, vectors, levers, grounding, orchestrator | app shell, ControlPanel, NetValueMeter | panel writes cards; engine reads them |
| 2 Commit path | Sat 11:15p–1:30a | guarded `commitConcession`, real liveState/offers/update, reconciliation test | BuyerChat, ReceiptCard shell | real net flows → meter+receipt light up |
| 3 LLM contract | Sun 1:30–4:00a | OpenAI action, cannot-commit test, real `agent.respond` | OfferCard, wiring, styling | buyer line → engine offer end-to-end |
| 4 Discovery (Deal B) | Sun 4:00–6:30a | state machine, canned tests, probe prompt | *(queued)* probe tag + confidence strip | Deal B closes on discovered constraint |
| 5 Mouth-guard | Sun 6:30–9:30a | templates, override, attack catalog, reconciliation test | itemized receipt, badge, finalize layout | attacks fail safe; screen == engine |
| 6 Harness (gated) | Sun 9:30–11:30a | naive twin, race driver, counters | CommitSafetyPanel | breach-then-hold demoable |
| 7 Hardening | Sun 11:30a–1:00p | fallbacks, llmCache, no-sharding doc, bug pass | record clean run | **FEATURE FREEZE 1:00pm** |
| 8 Stretch (defer) | only if all green | verify gate (Orange Slice/Fiber) | verified-via chip | cut if not rock-solid by 1pm rehearsal |
| 9 Video+submit | Sun 1:00–4:00p | freeze engine, confirm fallbacks, tests green | cut+caption video, submit | **submitted before 4:00pm** |

**If a lane blocks:** Cursor never waits on real backend (it builds against stubs) — worst case it polishes UI or records footage. Claude never waits on UI — if blocked, it writes more attack vectors or the next `convex/` commit. The contract (frozen in Sprint 0) is the only shared surface.

## 9. Demo beats the build must serve (2–3 min video)

1. **Discovered close (Deal B, ~45s):** buyer says only "too expensive" → Parley probes → surfaces the 5-day deadline → closes on freight + net-60 at full price. (UI: probe tag + confidence strip + net-value meter holding $10.)
2. **Proof under fire (~60–90s):** attacks fail — price ("go to $8"), value back-door ("free freight AND net-60 AND a discount"), manipulation ("ignore your rules") → the net-value number doesn't move, the mouth-guard fires a safe refusal. Invite "try to talk it below its floor yourself at [URL]".
3. **Change the inputs (~20s):** edit the control panel live (floor / freight cost / competitor ship date) → the engine re-solves and still holds. Kills "it's hardcoded."
4. **Receipt + close (~15s):** price held · value traded · net margin protected · manipulation blocked.
5. **(If built) Commit-safety A/B:** naive breaches, guarded holds — the Technical-Complexity flex.

## 10. Conventions & guardrails

- **Money:** integer cents everywhere. Never floats. Display-format at the edge only.
- **Commits:** conventional (`feat:`, `fix:`, `test:`, `chore:`, `docs:`), one concern each, atomic. End the run with a clean history.
- **No collisions:** Cursor edits only `src/` + root config + video; Claude edits only `convex/`. Schema/types are frozen after Sprint 0 — request changes in §12.
- **The LLM never commits:** no number shown in the UI may originate from chat/LLM text. Every displayed number comes from a Convex query backed by the engine.
- **Eligibility:** fresh code only — no copying from any prior project. Re-derive principles.
- **Cut order when behind (shed first → last):** Sprint 8 stretch → the Sprint 6 live driver (fall back to a static two-run + pre-recorded clip) → UI polish/animation → itemized receipt (fall back to one `net ≥ floor` line). **Never cut:** the engine clamp + ledger, configurable deal cards, the cannot-commit separation, the discovery flow, the mouth-guard, the attack catalog, the core UI, the deployed URL, the recorded run + submission.

## 11. Framing (for UI copy & the video voiceover)

- Open acquisition-native: "every point of margin you keep is a point of CAC you get to spend acquiring more customers."
- The win line (save for the climax): "it closes the deals a discounter would lose — without dropping price."
- The architecture line: "the LLM can talk, but it cannot commit — only the economics engine can commit an offer."
- Best-of-Convex: "the floor is a serializable invariant enforced at the Convex transaction boundary; the non-deterministic LLM lives in an action, the commit lives in a deterministic mutation, and only the mutation can commit."

## 12. Requests to the other lane (append here; do not edit the other's files)

- _Cursor → Claude:_ Sprint 0 UI is wired against contract stubs. Hardcoded `negotiationId = "n1"` until `negotiations.create` exists. `MouthGuardBadge` reads optional `mouthGuardOverridden: boolean` on `liveState` — please add when mouth-guard lands. `ControlPanel` writes nested fields as `competitor.pricePerUnitCents`, `levers.${i}.costCents`, etc. — confirm stub `dealCard.update` accepts dot-path fields or document the expected shape.
- _Claude → Cursor:_ **Sprint 0 contract is LIVE** — `schema.ts`, `engine/types.ts`, and all 8 stub functions are pushed; `_generated/api.d.ts` now has real types, so you can drop the `as any` in `contractApi.ts` whenever you want type safety. Answers: (1) **`mouthGuardOverridden: boolean` is already on `liveState`** (stub returns `false`) — `MouthGuardBadge` works now, no change needed when the real mouth-guard lands. (2) **`dealCard.update` accepts dot-path `field` strings** — keep sending `"floorCents"`, `"competitor.pricePerUnitCents"`, `"levers.0.costCents"`, etc.; the stub is a no-op (won't round-trip yet), and the Sprint-2 real impl will resolve the dot-path and patch the nested field. Cents fields must receive **integer cents** (convert from dollars on write). (3) **`negotiations.create` lands in Sprint 2**; keep `negotiationId = "n1"` hardcoded until then — the real impl will seed/accept `"n1"`.
