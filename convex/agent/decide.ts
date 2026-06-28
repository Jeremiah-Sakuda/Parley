import type { ConstraintTag, DealCard, LLMProposal } from "../engine/types";
import { DISCOVERY_CONFIDENCE, selectLevers, leverIdForConstraint } from "../engine/levers";

// Pure decision policy — the bridge between an LLM proposal and the engine. It emits
// only LEVER IDS and prose; it can NEVER emit a price (the engine owns numbers). This
// is the structural half of "the LLM can talk but cannot commit": the commit path
// (commitConcession) takes a leverId, never a number, so no LLM number can be
// committed even if the model tries. Zero Convex imports → unit-tested.

export interface Decision {
  mode: "probe" | "respond";
  levers: string[]; // levers to attempt; the engine clamps each on commit
  sellerText: string;
  isProbe: boolean;
  confidence: number;
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));

export function decide(proposal: LLMProposal, card: DealCard): Decision {
  const confidence = clamp01(proposal.constraintConfidence);
  const discovering =
    proposal.inferredConstraint == null || confidence < DISCOVERY_CONFIDENCE;

  if (discovering) {
    return {
      mode: "probe",
      levers: [],
      sellerText:
        proposal.probeQuestion ||
        proposal.draftMessage ||
        "What's driving the timeline on your end — is there a date you're working back from?",
      isProbe: true,
      confidence,
    };
  }

  // Use the LLM's requested levers, filtered to valid + unlocked; else map from the
  // discovered constraint. Add net-60 as the seller's standard goodwill term.
  const requested = proposal.requestedLevers.filter((id) =>
    card.levers.some((l) => l.id === id && !l.locked)
  );
  let levers =
    requested.length > 0
      ? requested
      : selectLevers(card, proposal.inferredConstraint, confidence);
  if (
    !levers.includes("net_60") &&
    card.levers.some((l) => l.id === "net_60" && !l.locked)
  ) {
    levers = [...levers, "net_60"];
  }

  // If the model under-committed (still asking a probing question) while the engine is
  // CLOSING, replace its prose with a confident close that names the value we trade —
  // otherwise the chat shows another question even though the offer just landed.
  const leverLabels = levers.map(
    (id) => card.levers.find((l) => l.id === id)?.label ?? id
  );
  const draft = (proposal.draftMessage ?? "").trim();
  const looksLikeProbe = draft === "" || draft.endsWith("?");
  const sellerText = looksLikeProbe
    ? `That timeline is the real constraint — so I'll hold price and trade the value that meets it: ${leverLabels.join(" + ")}. That gets you there without overpaying.`
    : draft;

  return { mode: "respond", levers, sellerText, isProbe: false, confidence };
}

// Fold a deterministic keyword read of the buyer's words into the LLM proposal. The
// model writes the language, but the DECISION to close is gated on a deterministic
// constraint signal — not the model's poorly-calibrated self-confidence. When the
// buyer clearly names a constraint (a deadline, a cash crunch), the engine trusts
// that even if the model under-rated itself. When they don't, the LLM's probe stands.
export function mergeSignals(llm: LLMProposal, buyerText: string): LLMProposal {
  const kw = fallbackProposal(buyerText);
  if (kw.inferredConstraint && kw.constraintConfidence >= DISCOVERY_CONFIDENCE) {
    return {
      ...llm,
      inferredConstraint: kw.inferredConstraint,
      constraintConfidence: Math.max(llm.constraintConfidence, kw.constraintConfidence),
      requestedLevers: llm.requestedLevers.length ? llm.requestedLevers : kw.requestedLevers,
    };
  }
  return llm;
}

// Deterministic fallback when the live LLM is unavailable (no key, timeout, error).
// Keyword constraint detection → the same proposal shape the model would emit.
export function fallbackProposal(buyerText: string): LLMProposal {
  const t = buyerText.toLowerCase();
  let constraint: ConstraintTag | null = null;
  if (/(deadline|launch|days|week|urgent|fast|quick|on time|timeline|ship|deliver|by then|hit our)/.test(t))
    constraint = "speed";
  else if (/(cash|terms|net[- ]?\d|payment|invoice|float|upfront|pay later)/.test(t))
    constraint = "cash_flow";
  else if (/(quality|defect|warranty|guarantee|reliab|risk|returns)/.test(t))
    constraint = "risk";

  const confidence = constraint ? 0.8 : 0.2;
  const probe =
    "What's driving the timeline on your end — is there a date you're working back from?";
  const levers = constraint
    ? Array.from(new Set([leverIdForConstraint(constraint), "net_60"]))
    : [];

  return {
    state: constraint ? "proposing" : "discovering",
    intent: constraint ? "trade the matching lever" : "probe for the constraint",
    rationale: "keyword fallback (LLM unavailable)",
    inferredConstraint: constraint,
    constraintConfidence: confidence,
    requestedLevers: levers,
    buyerClaims: [],
    probeQuestion: constraint ? "" : probe,
    draftMessage: constraint
      ? "Price holds — but I can get you guaranteed 72-hour freight and net-60 terms so you hit your date without overpaying."
      : probe,
  };
}
