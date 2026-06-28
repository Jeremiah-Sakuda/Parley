import type { ConstraintTag, DealCard } from "./types";
import { listTotal } from "./clamp";

// The single confidence gate shared by lever selection AND the discovery state
// machine (Sprint 4), so the two never disagree (no select-then-yank flicker).
export const DISCOVERY_CONFIDENCE = 0.6;

// Constraint → the lever that answers it. This is the "trade the matching lever"
// logic: a deadline buys speed, a cash crunch buys terms, risk buys a guarantee.
const CONSTRAINT_TO_LEVER: Record<ConstraintTag, string> = {
  speed: "freight_72h",
  cash_flow: "net_60",
  risk: "defect_guarantee",
  volume: "account_pricing",
};

// Pick the lever matching the discovered constraint — but only once we're confident
// enough about the constraint. Below the gate, return nothing so the agent keeps
// probing instead of conceding blind. Never returns a lever that breaches the floor.
export function selectLevers(
  card: DealCard,
  constraint: ConstraintTag | null,
  confidence: number
): string[] {
  if (constraint == null || confidence < DISCOVERY_CONFIDENCE) return [];
  const leverId = CONSTRAINT_TO_LEVER[constraint];
  const lever = card.levers.find((l) => l.id === leverId);
  if (!lever || lever.locked) return [];
  if (listTotal(card) - lever.costCents < card.floorCents) return [];
  return [leverId];
}
