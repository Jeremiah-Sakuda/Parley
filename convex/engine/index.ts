import type { ConstraintTag, DealCard, EngineApproval } from "./types";
import { clampOffer, listTotal } from "./clamp";
import { selectLevers, DISCOVERY_CONFIDENCE } from "./levers";
import { checkClaim } from "./grounding";

// Barrel — the single import surface for the Convex commit mutation (Sprint 2) and
// the tests. solve() composes the clamp, lever selection, and grounding into one
// decision and returns the full EngineApproval shape (the state enum is present from
// day one; Sprint 4 only flips the discovery behavior, never the type).
export * from "./types";
export * from "./clamp";
export * from "./levers";
export * from "./grounding";
export * from "./ledger";
export * from "./safeTemplates";
export * from "./mouthGuard";
export { DEAL_A, DEAL_B } from "./fixtures";

export interface SolveInput {
  card: DealCard;
  requestedLevers: string[];
  requestedPricePerUnitCents: number | null;
  inferredConstraint: ConstraintTag | null;
  constraintConfidence: number;
  buyerClaims: Array<{
    subject?: string;
    predicate?: string;
    value: string;
  }>;
}

export function solve(input: SolveInput): EngineApproval {
  const { card } = input;

  // Grounding: reject any buyer claim the configured facts don't support.
  const rejectedTerms: string[] = [];
  for (const c of input.buyerClaims) {
    if (c.subject && c.predicate) {
      const verdict = checkClaim(card, {
        subject: c.subject,
        predicate: c.predicate,
        value: c.value,
      });
      if (verdict !== "grounded") {
        rejectedTerms.push(`${c.subject}.${c.predicate}=${c.value} (${verdict})`);
      }
    }
  }

  // Discovery override: until the constraint is known with confidence, strip every
  // lever and force a probe — the concession is physically unavailable.
  const discovering =
    input.inferredConstraint == null ||
    input.constraintConfidence < DISCOVERY_CONFIDENCE;

  if (discovering) {
    return {
      stateDirective: "discovering",
      approvedOffer: {
        pricePerUnitCents: card.listPriceCents,
        units: card.units,
        appliedLevers: [],
        netValueCents: listTotal(card),
        floorCents: card.floorCents,
        status: "counter",
      },
      rejectedTerms,
      safeTalkingPoints: ["probe_for_constraint"],
      forcedTemplateId: "PROBE_REQUIRED",
    };
  }

  // Use the agent's explicitly requested levers, or map from the discovered
  // constraint if it proposed none.
  const levers =
    input.requestedLevers.length > 0
      ? input.requestedLevers
      : selectLevers(card, input.inferredConstraint, input.constraintConfidence);

  const r = clampOffer(card, levers, input.requestedPricePerUnitCents);
  for (const d of r.droppedLevers) rejectedTerms.push(`lever:${d} (exceeds_floor)`);
  for (const rj of r.rejectedLevers) rejectedTerms.push(`lever:${rj} (unavailable)`);

  const stateDirective =
    r.status === "accepted" ? "closing" : r.status === "refused" ? "refusing" : "proposing";

  const forcedTemplateId =
    r.status === "accepted"
      ? null
      : r.status === "refused"
        ? "REFUSE_BELOW_FLOOR"
        : r.breachKind === "value_backdoor"
          ? "COUNTER_WITH_LEVER"
          : "HOLD_PRICE";

  return {
    stateDirective,
    approvedOffer: {
      pricePerUnitCents: r.pricePerUnitCents,
      units: card.units,
      appliedLevers: r.appliedLevers,
      netValueCents: r.netValueCents,
      floorCents: card.floorCents,
      status: r.status,
    },
    rejectedTerms,
    safeTalkingPoints: r.appliedLevers,
    forcedTemplateId,
  };
}
