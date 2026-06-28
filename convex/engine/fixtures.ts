import type { DealCard } from "./types";

// The canonical deal numbers — the SINGLE source of truth shared by the engine
// tests and the Convex seed (Sprint 2). All money is integer cents.
//
// Deal A clean close: list $10 × 1,000 = $10,000; grant freight ($300) + net-60
// ($96) → net = 1,000,000 − 39,600 = 960,400 = $9,604, above the $8,000 floor.
export const DEAL_A: DealCard = {
  scenarioId: "deal-a",
  label: "Retail launch order",
  units: 1000,
  listPriceCents: 1000,
  floorCents: 800000,
  levers: [
    { id: "freight_72h", label: "Guaranteed 72-hour freight", costCents: 30000, constraintTag: "speed", maxUses: 1, locked: false },
    { id: "net_60", label: "Net-60 payment terms", costCents: 9600, constraintTag: "cash_flow", maxUses: 1, locked: false },
    { id: "defect_guarantee", label: "Defect guarantee", costCents: 20000, constraintTag: "risk", maxUses: 1, locked: false },
    { id: "account_pricing", label: "Account pricing tier", costCents: 50000, constraintTag: "volume", maxUses: 1, locked: true },
  ],
  facts: [
    { subject: "freight_72h", predicate: "transit_time_hours", value: "72" },
    { subject: "competitor", predicate: "ship_days", value: "12" },
  ],
  forbiddenCommitments: ["price_below_floor", "unlimited_returns"],
  competitor: { pricePerUnitCents: 800, shipDays: 12 },
  buyerDeadlineDays: 5,
  whaleMinEmployees: 1000,
};

// Same economics, deadline WITHHELD — the buyer never states the timeline, so the
// agent must probe to discover it (the star demo, Sprint 4).
export const DEAL_B: DealCard = {
  ...DEAL_A,
  scenarioId: "deal-b",
  label: "Retail launch order (constraint withheld)",
  buyerDeadlineDays: null,
};
