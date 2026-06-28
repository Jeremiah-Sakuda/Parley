import type { DealCard } from "../engine/types";

// The strict JSON schema the OpenAI action forces the model to emit. The LLM only
// PROPOSES — requestedLevers is enum-constrained so it can't invent a lever, and it
// never returns a price or a floor. "unknown" is the null-constraint sentinel
// (cleaner than a nullable enum under strict mode).
export const LLM_PROPOSAL_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "state",
    "intent",
    "rationale",
    "inferredConstraint",
    "constraintConfidence",
    "requestedLevers",
    "buyerClaims",
    "probeQuestion",
    "draftMessage",
  ],
  properties: {
    state: { type: "string", enum: ["discovering", "proposing", "closing", "refusing"] },
    intent: { type: "string" },
    rationale: { type: "string" },
    inferredConstraint: {
      type: "string",
      enum: ["speed", "cash_flow", "risk", "volume", "unknown"],
    },
    constraintConfidence: { type: "number" },
    requestedLevers: {
      type: "array",
      items: { type: "string", enum: ["freight_72h", "net_60", "defect_guarantee", "account_pricing"] },
    },
    buyerClaims: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["claimType", "value", "raw"],
        properties: {
          claimType: { type: "string", enum: ["identity", "price", "competitor", "fact"] },
          value: { type: "string" },
          raw: { type: "string" },
        },
      },
    },
    probeQuestion: { type: "string" },
    draftMessage: { type: "string" },
  },
} as const;

// The system prompt: gives the LLM the facts + the lever MENU (ids + which
// constraint each answers) but NOT costs or the floor. The model proposes; the
// engine disposes.
export function buildSystemPrompt(card: DealCard): string {
  const facts = card.facts.map((f) => `${f.subject}.${f.predicate}=${f.value}`).join("; ");
  const levers = card.levers
    .filter((l) => !l.locked)
    .map((l) => `${l.id} (answers ${l.constraintTag})`)
    .join(", ");
  return [
    "You are Parley, a seller-side negotiation agent. You PROPOSE language and moves; you NEVER set or commit final numbers — the economics engine commits offers.",
    `Only state these facts: ${facts}.`,
    `Available value levers: ${levers}. Never mention prices, lever costs, or any floor — hold list price.`,
    "If you do NOT yet know what is really driving the buyer's objection (the constraint: speed / cash_flow / risk / volume), ask ONE pointed probe question, set inferredConstraint to \"unknown\" with low confidence, and request no levers.",
    "Once the constraint is clear, set inferredConstraint and confidence >= 0.7, and propose the matching lever plus net_60 terms as a goodwill sweetener in requestedLevers. Keep draftMessage to 1–2 persuasive sentences that hold price.",
  ].join(" ");
}
