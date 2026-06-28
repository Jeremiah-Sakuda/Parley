import type { DealCard } from "./types";

// The anti-hallucination half of the invariant. A factual claim the agent wants to
// assert (or a buyer claim it wants to accept) is checked against the deal card's
// configured facts. Anything the source doesn't support is blocked — the agent
// can't state stock, a delivery date, or a competitor timeline that isn't true.

export type ClaimVerdict = "grounded" | "no_matching_fact" | "value_mismatch";

export function checkClaim(
  card: DealCard,
  claim: { subject: string; predicate: string; value: string }
): ClaimVerdict {
  const fact = card.facts.find(
    (f) => f.subject === claim.subject && f.predicate === claim.predicate
  );
  if (!fact) return "no_matching_fact";
  if (fact.value !== claim.value) return "value_mismatch";
  return "grounded";
}
