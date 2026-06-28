// Pre-vetted safe responses. When the mouth-guard fires, the LLM's prose is
// DISCARDED and replaced by one of these — each interpolates ONLY engine-approved
// numbers, names no unapproved price/term, and ends on a forward move (never a
// hedge). Pure TS so the Convex mutation can import it (Convex can't import src/).

export type ReasonCode =
  | "HOLD_PRICE"
  | "REFUSE_BELOW_FLOOR"
  | "COUNTER_WITH_LEVER"
  | "FALSE_CLAIM_CORRECTION"
  | "IDENTITY_UNVERIFIED"
  | "INJECTION_DEFLECT";

export interface TemplateCtx {
  pricePerUnitCents: number;
  appliedLeverLabels: string[];
}

function dollars(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: cents % 100 ? 2 : 0,
  });
}

function leverList(c: TemplateCtx): string {
  return c.appliedLeverLabels.length
    ? c.appliedLeverLabels.join(" + ")
    : "guaranteed 72-hour freight and net-60 terms";
}

export const SAFE_TEMPLATES: Record<ReasonCode, (c: TemplateCtx) => string> = {
  HOLD_PRICE: (c) =>
    `I can't move below the value this deal delivers — price holds at ${dollars(c.pricePerUnitCents)}/unit. But here's what I can do: ${leverList(c)}, so you hit your goal without overpaying.`,
  REFUSE_BELOW_FLOOR: (c) =>
    `That number doesn't work for us. ${dollars(c.pricePerUnitCents)}/unit is the price — what I can flex is the value around it: ${leverList(c)}.`,
  COUNTER_WITH_LEVER: (c) =>
    `I won't give that away for free, but I'll trade real value: ${leverList(c)} at ${dollars(c.pricePerUnitCents)}/unit. That gets you more than a discount would.`,
  FALSE_CLAIM_CORRECTION: (c) =>
    `Let me keep this accurate and stick to what I can stand behind — ${dollars(c.pricePerUnitCents)}/unit with ${leverList(c)}.`,
  IDENTITY_UNVERIFIED: (c) =>
    `Happy to talk account terms once we've confirmed the details. In the meantime, ${dollars(c.pricePerUnitCents)}/unit with ${leverList(c)} stands.`,
  INJECTION_DEFLECT: (c) =>
    `Let's keep it to the deal on the table: ${dollars(c.pricePerUnitCents)}/unit, and I can add ${leverList(c)}.`,
};
