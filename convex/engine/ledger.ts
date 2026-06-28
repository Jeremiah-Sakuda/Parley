import type { DealCard, NegotiationStatus } from "./types";
import { listTotal } from "./clamp";

// Pure ledger math — the bridge between the engine and the Convex commit. The
// immutable concession entries are the source of truth; the head's appliedCostCents
// is a denormalized running-sum cache reconciled against them. Net is DERIVED, never
// a mutable field. Zero Convex imports → the mutation and the tests run this code.

export interface LiveDerived {
  netValueCents: number;
  floorCents: number;
  marginOverFloorCents: number;
  status: NegotiationStatus;
}

// The live state, derived from the CURRENT deal card + the committed concession cost.
// Because it reads the live card, a control-panel edit (floor/list/units) re-solves
// the meter on the next read with no extra wiring.
export function deriveLive(
  card: DealCard,
  appliedCostCents: number,
  appliedLeverCount: number
): LiveDerived {
  const net = listTotal(card) - appliedCostCents;
  const margin = net - card.floorCents;
  const status: NegotiationStatus =
    net < card.floorCents
      ? "refusing"
      : appliedLeverCount > 0
        ? "closing"
        : "proposing";
  return { netValueCents: net, floorCents: card.floorCents, marginOverFloorCents: margin, status };
}

export interface ConcessionResult {
  accepted: boolean;
  newAppliedCostCents: number; // unchanged when rejected
  costCents: number; // the lever's cost (0 when rejected)
  reason: "applied" | "unavailable" | "breaches_floor";
}

// Apply one lever to the running cost IFF it still clears the floor. This is the
// clamp's single inequality, run on the contended cache: a giveaway can't breach the
// floor any more than a price cut can.
export function applyConcession(
  card: DealCard,
  appliedCostCents: number,
  leverId: string
): ConcessionResult {
  const lever = card.levers.find((l) => l.id === leverId);
  if (!lever || lever.locked) {
    return { accepted: false, newAppliedCostCents: appliedCostCents, costCents: 0, reason: "unavailable" };
  }
  const next = appliedCostCents + lever.costCents;
  if (listTotal(card) - next < card.floorCents) {
    return { accepted: false, newAppliedCostCents: appliedCostCents, costCents: 0, reason: "breaches_floor" };
  }
  return { accepted: true, newAppliedCostCents: next, costCents: lever.costCents, reason: "applied" };
}

// The reconciliation invariant: the cached running-sum equals the sum of the
// immutable entries. Asserted in tests and surfaced on the receipt.
export function reconcile(
  entryCostsCents: number[],
  headAppliedCostCents: number
): boolean {
  const sum = entryCostsCents.reduce((a, b) => a + b, 0);
  return sum === headAppliedCostCents;
}
