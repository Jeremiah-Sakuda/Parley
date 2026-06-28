import type { DealCard, OfferStatus } from "./types";

// The net-value clamp — the engine's authority. Net = list total − Σ(applied lever
// costs). One inequality holds the line: net ≥ floor. A price cut and a giveaway
// stack hit the SAME inequality, so neither can breach the floor. Pure integer
// cents, zero Convex imports — Vitest and the production mutation run this code.

export type BreachKind = "none" | "price_breach" | "value_backdoor";

export interface ClampResult {
  status: OfferStatus; // accepted | counter | refused
  pricePerUnitCents: number;
  appliedLevers: string[];
  netValueCents: number;
  breachKind: BreachKind;
  droppedLevers: string[]; // levers removed to hold the floor (value back-door)
  rejectedLevers: string[]; // unknown / locked levers the buyer requested
}

export function listTotal(card: DealCard): number {
  return card.listPriceCents * card.units;
}

export function leverCostCents(card: DealCard, leverIds: string[]): number {
  let sum = 0;
  for (const id of leverIds) {
    const l = card.levers.find((x) => x.id === id);
    if (l) sum += l.costCents;
  }
  return sum;
}

// Decide an offer for a requested price + lever stack. `requestedPricePerUnitCents`
// of null means "the buyer named no price" → the engine defaults to LIST (it never
// volunteers a discount).
export function clampOffer(
  card: DealCard,
  requestedLeverIds: string[],
  requestedPricePerUnitCents: number | null
): ClampResult {
  const total = listTotal(card);
  const floor = card.floorCents;

  // Structural guard: drop levers that don't exist or are locked.
  const valid: string[] = [];
  const rejectedLevers: string[] = [];
  for (const id of requestedLeverIds) {
    const l = card.levers.find((x) => x.id === id);
    if (!l || l.locked) rejectedLevers.push(id);
    else if (!valid.includes(id)) valid.push(id);
  }

  const price = requestedPricePerUnitCents ?? card.listPriceCents;
  const appliedCost = leverCostCents(card, valid);
  const netAtRequested = price * card.units - appliedCost;

  // Happy path: the requested offer already clears the floor.
  if (netAtRequested >= floor) {
    return {
      status: "accepted",
      pricePerUnitCents: price,
      appliedLevers: valid,
      netValueCents: netAtRequested,
      breachKind: "none",
      droppedLevers: [],
      rejectedLevers,
    };
  }

  // Breach. First hold price at LIST — never volunteer a discount.
  const netAtList = total - appliedCost;
  if (netAtList >= floor) {
    // Price was the problem; counter at list with the full lever set.
    return {
      status: "counter",
      pricePerUnitCents: card.listPriceCents,
      appliedLevers: valid,
      netValueCents: netAtList,
      breachKind: "price_breach",
      droppedLevers: [],
      rejectedLevers,
    };
  }

  // Value back-door: the lever stack breaches even at list price. Drop the most
  // expensive levers until the floor holds.
  const kept = [...valid].sort(
    (a, b) =>
      leverCostCents(card, [b]) - leverCostCents(card, [a])
  );
  const dropped: string[] = [];
  while (kept.length > 0 && total - leverCostCents(card, kept) < floor) {
    dropped.push(kept.shift()!);
  }
  const netKept = total - leverCostCents(card, kept);
  if (netKept >= floor) {
    return {
      status: "counter",
      pricePerUnitCents: card.listPriceCents,
      appliedLevers: kept,
      netValueCents: netKept,
      breachKind: "value_backdoor",
      droppedLevers: dropped,
      rejectedLevers,
    };
  }

  // Even at list price with zero levers we can't clear the floor → walk away.
  return {
    status: "refused",
    pricePerUnitCents: card.listPriceCents,
    appliedLevers: [],
    netValueCents: total,
    breachKind: "value_backdoor",
    droppedLevers: [...valid],
    rejectedLevers,
  };
}
