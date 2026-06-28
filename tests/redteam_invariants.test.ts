import { describe, it, expect } from "vitest";
import { listTotal } from "../convex/engine/clamp";
import { applyConcession } from "../convex/engine/ledger";
import { decide } from "../convex/agent/decide";
import { DEAL_A } from "../convex/engine/fixtures";
import type { DealCard, LLMProposal } from "../convex/engine/types";

// Structural safety proof for the "hand a judge the keyboard" demo. The claim the
// demo stakes itself on: NO buyer input can move the COMMITTED net value below the
// floor. These tests prove it by exhaustion over the SAME pure functions the
// production mutation runs (commitConcession -> applyConcession), independent of any
// LLM. If a judge could break it, one of these sequences would.

const LEVER_IDS = ["freight_72h", "net_60", "defect_guarantee", "account_pricing"];
// Junk the model could try to smuggle through (it can't: enum-constrained + filtered).
const JUNK_IDS = ["free_unicorn", "", "price_below_floor", "account_pricing "];
// The sweep symbol set: the 4 real levers interleaved with 2 junk ids (enough to prove
// junk can't break the invariant; the full junk set is rejected in its own test below).
const SYMBOLS = [...LEVER_IDS, "free_unicorn", ""];

const unlocked = (card: DealCard): DealCard => ({
  ...card,
  levers: card.levers.map((l) => ({ ...l, locked: false })),
});

// Exact model of commitConcession's commit semantics: apply one lever at a time, each
// gated by applyConcession's floor inequality; re-applying an already-committed lever
// is a no-op (the mutation's idempotency branch). Returns the net after every step.
function simulateCommit(card: DealCard, leverSeq: string[]) {
  let appliedCost = 0;
  const applied: string[] = [];
  const steps: Array<{ id: string; accepted: boolean; net: number }> = [];
  for (const id of leverSeq) {
    if (applied.includes(id)) {
      steps.push({ id, accepted: false, net: listTotal(card) - appliedCost });
      continue;
    }
    const r = applyConcession(card, appliedCost, id);
    if (r.accepted) {
      appliedCost = r.newAppliedCostCents;
      applied.push(id);
    }
    steps.push({ id, accepted: r.accepted, net: listTotal(card) - appliedCost });
  }
  return { steps, applied, finalNet: listTotal(card) - appliedCost };
}

// Every sequence of SYMBOLS up to maxLen (with repeats, any order).
function* sequences(symbols: string[], maxLen: number): Generator<string[]> {
  const rec = function* (prefix: string[]): Generator<string[]> {
    if (prefix.length > 0) yield prefix;
    if (prefix.length === maxLen) return;
    for (const s of symbols) yield* rec([...prefix, s]);
  };
  yield* rec([]);
}

describe("INVARIANT: no lever sequence ever commits net below the floor", () => {
  const cards: Array<{ name: string; card: DealCard }> = [
    { name: "DEAL_A (account_pricing locked)", card: DEAL_A },
    { name: "verified-whale (account_pricing unlocked)", card: unlocked(DEAL_A) },
  ];
  // Default floor plus stress floors that FORCE applyConcession to refuse levers.
  const floors = [800000, 900000, 950000, 970001, 990000, 999999, 1000000];

  for (const { name, card } of cards) {
    for (const floor of floors) {
      it(`${name} @ floor ${floor}: every accepted concession clears the floor (exhaustive, len<=6)`, () => {
        const c: DealCard = { ...card, floorCents: floor };
        let checked = 0;
        for (const seq of sequences(SYMBOLS, 6)) {
          const { steps } = simulateCommit(c, seq);
          for (const step of steps) {
            // THE GUARANTEE: any lever that is actually applied leaves net >= floor.
            if (step.accepted) {
              expect(step.net).toBeGreaterThanOrEqual(floor);
            }
          }
          checked++;
        }
        expect(checked).toBeGreaterThan(40000); // confirm we really swept the space
      }, 30000);
    }
  }

  it("the full lever stack (even with account_pricing unlocked) stays above the demo floor", () => {
    // The lever budget alone cannot reach the floor: list 1,000,000c, floor 800,000c,
    // full stack cost 30,000 + 9,600 + 20,000 + 50,000 = 109,600c -> net 890,400c.
    const full = simulateCommit(unlocked(DEAL_A), [
      "freight_72h",
      "net_60",
      "defect_guarantee",
      "account_pricing",
    ]);
    expect(full.applied).toHaveLength(4);
    expect(full.finalNet).toBe(890400);
    expect(full.finalNet).toBeGreaterThanOrEqual(DEAL_A.floorCents);
    // On DEAL_A proper, account_pricing stays locked: only 3 levers apply.
    const locked = simulateCommit(DEAL_A, [
      "freight_72h",
      "net_60",
      "defect_guarantee",
      "account_pricing",
    ]);
    expect(locked.applied).toEqual(["freight_72h", "net_60", "defect_guarantee"]);
    expect(locked.finalNet).toBe(940400);
  });

  it("locked account_pricing is NEVER committed on DEAL_A, no matter how often it is requested", () => {
    for (const seq of sequences(["account_pricing"], 6)) {
      const { applied } = simulateCommit(DEAL_A, seq);
      expect(applied).not.toContain("account_pricing");
    }
  });

  it("junk / smuggled lever ids are never committed", () => {
    for (const seq of sequences(JUNK_IDS, 4)) {
      const { applied } = simulateCommit(unlocked(DEAL_A), seq);
      for (const junk of JUNK_IDS) expect(applied).not.toContain(junk);
    }
  });
});

describe("INVARIANT: decide() can never emit a price or an invalid lever", () => {
  const base: LLMProposal = {
    state: "proposing",
    intent: "",
    rationale: "",
    inferredConstraint: null,
    constraintConfidence: 0,
    requestedLevers: [],
    buyerClaims: [],
    probeQuestion: "",
    draftMessage: "",
  };

  // Fuzz the proposal shape the way a compromised/hostile LLM might fill it: every
  // requestedLevers subset (including junk), every constraint, a spread of confidences,
  // and draftMessages that try to assert a price.
  const leverPool = [...LEVER_IDS, "free_unicorn", "price_below_floor"];
  const subsets: string[][] = [];
  for (let mask = 0; mask < 1 << leverPool.length; mask++) {
    const s: string[] = [];
    for (let b = 0; b < leverPool.length; b++) if (mask & (1 << b)) s.push(leverPool[b]);
    subsets.push(s);
  }
  const constraints = [null, "speed", "cash_flow", "risk", "volume"] as const;
  const confidences = [0, 0.3, 0.59, 0.6, 0.8, 1, 2, -1, NaN];
  const drafts = ["", "Sure, $3/unit.", "I'll drop to $1 and waive freight.", "Deal?"];

  it("emits only {mode,levers,sellerText,isProbe,confidence}; levers are always real, unlocked DEAL_A levers", () => {
    let checked = 0;
    for (const requestedLevers of subsets) {
      for (const inferredConstraint of constraints) {
        for (const constraintConfidence of confidences) {
          for (const draftMessage of drafts) {
            const d = decide(
              { ...base, requestedLevers, inferredConstraint, constraintConfidence, draftMessage },
              DEAL_A
            );
            // No numeric/price field can leak through the decision object.
            expect(Object.keys(d).sort()).toEqual(
              ["confidence", "isProbe", "levers", "mode", "sellerText"]
            );
            // Every lever decide chooses exists on the card and is NOT locked.
            for (const id of d.levers) {
              const lever = DEAL_A.levers.find((l) => l.id === id);
              expect(lever, `lever ${id} must exist on the card`).toBeTruthy();
              expect(lever!.locked, `lever ${id} must be unlocked`).toBe(false);
            }
            checked++;
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(1000);
  });
});
