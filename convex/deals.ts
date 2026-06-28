import { query } from "./_generated/server";
import { v } from "convex/values";

// STUB (Sprint 0): returns the Deal A fixture. Real impl (Sprint 2) reads the
// dealCards table and is editable live via dealCard.update. Signature is frozen.
const DEAL_A = {
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
  buyerDeadlineDays: 5 as number | null,
  whaleMinEmployees: 1000,
};

export const activeCard = query({
  args: { scenarioId: v.string() },
  returns: v.object({
    scenarioId: v.string(),
    label: v.string(),
    units: v.number(),
    listPriceCents: v.number(),
    floorCents: v.number(),
    levers: v.array(
      v.object({
        id: v.string(),
        label: v.string(),
        costCents: v.number(),
        constraintTag: v.string(),
        maxUses: v.number(),
        locked: v.boolean(),
      })
    ),
    facts: v.array(v.object({ subject: v.string(), predicate: v.string(), value: v.string() })),
    forbiddenCommitments: v.array(v.string()),
    competitor: v.object({ pricePerUnitCents: v.number(), shipDays: v.number() }),
    buyerDeadlineDays: v.union(v.number(), v.null()),
    whaleMinEmployees: v.number(),
  }),
  handler: async () => DEAL_A,
});
