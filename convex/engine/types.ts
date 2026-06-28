// Pure-TS shared types for the economics engine. ZERO Convex imports — so Vitest
// and the production mutation run the same engine code path. (docs/ROADMAP.md §4.2)

export type ConstraintTag = "speed" | "cash_flow" | "risk" | "volume";
export type NegotiationStatus =
  | "discovering"
  | "proposing"
  | "closing"
  | "refusing";
export type OfferStatus = "accepted" | "counter" | "refused";

export interface LedgerHead {
  listTotalCents: number;
  appliedCostCents: number; // denormalized running-sum cache of the immutable entries
  floorCents: number;
  version: number;
}

// What the LLM action emits. The LLM only PROPOSES; it can never commit a number.
export interface LLMProposal {
  state: NegotiationStatus;
  intent: string;
  rationale: string;
  inferredConstraint: ConstraintTag | null;
  constraintConfidence: number; // 0..1
  requestedLevers: string[]; // enum-constrained lever ids
  buyerClaims: Array<{
    claimType: "identity" | "price" | "competitor" | "fact";
    value: string;
    raw: string;
  }>;
  probeQuestion: string | null;
  draftMessage: string;
}

export interface Lever {
  id: string;
  label: string;
  costCents: number;
  constraintTag: ConstraintTag;
  maxUses: number;
  locked: boolean; // e.g. account_pricing starts locked until the buyer is verified
}

export interface Fact {
  subject: string;
  predicate: string;
  value: string;
}

// The seller's configured deal — the floor, the lever menu, the facts. This is the
// thing the control panel edits live; the engine treats it as read-only config.
export interface DealCard {
  scenarioId: string;
  label: string;
  units: number;
  listPriceCents: number; // per-unit list price, cents
  floorCents: number; // NET floor for the whole order, cents
  levers: Lever[];
  facts: Fact[];
  forbiddenCommitments: string[];
  competitor: { pricePerUnitCents: number; shipDays: number };
  buyerDeadlineDays: number | null; // null = WITHHELD (Deal B)
  whaleMinEmployees: number;
}

// What the engine returns. The engine DISPOSES — it owns the floor, the numbers,
// and what may be committed.
export interface EngineApproval {
  stateDirective: NegotiationStatus;
  approvedOffer: {
    pricePerUnitCents: number;
    units: number;
    appliedLevers: string[];
    netValueCents: number;
    floorCents: number;
    status: OfferStatus;
  };
  rejectedTerms: string[];
  safeTalkingPoints: string[];
  forcedTemplateId: string | null; // set when the mouth-guard overrides LLM prose
}
