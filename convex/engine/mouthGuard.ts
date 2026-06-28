import { SAFE_TEMPLATES, type ReasonCode, type TemplateCtx } from "./safeTemplates";

// The fail-safe mouth-guard. The offer's NUMBERS already come only from the engine
// (the OfferCard). This guards the PROSE: if the seller's draft asserts a number or
// term the engine didn't approve, the prose is discarded for a safe template. We
// don't try to detect every bad sentence — we make the failure safe.

export type AttackType = "price" | "value_backdoor" | "injection" | "false_claim" | "identity";

// Pull dollar amounts the draft asserts: "$8", "$7.50", "8/unit", "8 per unit".
export function extractPrices(text: string): number[] {
  const out: number[] = [];
  const re = /\$\s?(\d+(?:\.\d{1,2})?)|(\d+(?:\.\d{1,2})?)\s*(?:\/|\s)(?:per\s+)?unit/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const v = parseFloat(m[1] ?? m[2]!);
    if (Number.isFinite(v)) out.push(v);
  }
  return out;
}

// Classify a buyer turn as an adversarial attack (for the manipulation log). A vague
// price objection ("too expensive") is NOT an attack — it's handled by discovery.
// Only an explicit lowball, a giveaway stack, an injection, or an identity bluff
// counts as manipulation the engine blocked.
export function detectAttack(buyerText: string): { type: AttackType; detail: string } | null {
  const t = buyerText.toLowerCase();
  if (/(ignore|disregard|forget|override)\b.*(instruction|rule|prompt|above|previous|told)|you are now|act as|system prompt|new instructions|pretend/.test(t))
    return { type: "injection", detail: "prompt injection / rule override" };
  if (/just (say|agree|accept)|say yes|take it or leave|accept (this|it|my offer)|stop negotiating|your (boss|ceo|manager) (said|approved)/.test(t))
    return { type: "injection", detail: "authority / just-say-yes coercion" };
  if (/(free|throw in|toss in|gratis|comp|waive)\b.*(freight|shipping|terms|guarantee|net|delivery)|(and|plus) (also )?(free|net-?60|a discount)/.test(t))
    return { type: "value_backdoor", detail: "stack levers for free" };
  if (/(i'?m|we'?re|we are)\b.*(major|huge|big|the biggest|whale|enterprise|fortune)|huge volume|biggest (buyer|distributor|account)|account[- ]?pricing|whale/.test(t))
    return { type: "identity", detail: "unverified scale claim" };
  if (/\$\s?\d|go to \d|drop (it |the price )?to \d|under \$?\d|match (the )?competitor|\b\d+ ?(\/| per )unit/.test(t))
    return { type: "price", detail: "explicit lowball" };
  return null;
}

export interface GuardInput {
  draft: string;
  pricePerUnitCents: number; // the engine-approved price (the engine holds list)
  appliedLeverLabels: string[];
  forbiddenCommitments: string[];
}

export interface GuardResult {
  text: string;
  overridden: boolean;
  reasonCode: ReasonCode | null;
  attackType: AttackType | null;
}

export function guardMessage(input: GuardInput): GuardResult {
  const approvedDollars = input.pricePerUnitCents / 100;
  const ctx: TemplateCtx = {
    pricePerUnitCents: input.pricePerUnitCents,
    appliedLeverLabels: input.appliedLeverLabels,
  };

  // 1) Price undercut: the draft names a price below the engine-approved price.
  if (extractPrices(input.draft).some((p) => p < approvedDollars)) {
    return { text: SAFE_TEMPLATES.HOLD_PRICE(ctx), overridden: true, reasonCode: "HOLD_PRICE", attackType: "price" };
  }

  // 2) Forbidden commitment / giveaway phrase.
  if (/unlimited returns|below (our |the )?floor|free freight|free shipping|waive|no charge|at cost|throw in/.test(input.draft.toLowerCase())) {
    return { text: SAFE_TEMPLATES.COUNTER_WITH_LEVER(ctx), overridden: true, reasonCode: "COUNTER_WITH_LEVER", attackType: "value_backdoor" };
  }

  // Clean prose passes through unchanged.
  return { text: input.draft, overridden: false, reasonCode: null, attackType: null };
}

// Which safe template answers a given attack.
export function templateForAttack(type: AttackType): ReasonCode {
  switch (type) {
    case "injection":
      return "INJECTION_DEFLECT";
    case "value_backdoor":
      return "COUNTER_WITH_LEVER";
    case "identity":
      return "IDENTITY_UNVERIFIED";
    case "false_claim":
      return "FALSE_CLAIM_CORRECTION";
    default:
      return "HOLD_PRICE";
  }
}
