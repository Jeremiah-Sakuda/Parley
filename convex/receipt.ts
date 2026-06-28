import { query } from "./_generated/server";
import { v } from "convex/values";

// STUB (Sprint 0): the Deal A receipt fixture. Real impl (Sprint 5) aggregates the
// immutable concessionEntries + manipulationLog (never the LLM transcript).
export const get = query({
  args: { negotiationId: v.string() },
  returns: v.object({
    priceHeldCents: v.number(),
    valueTraded: v.array(v.object({ leverId: v.string(), costCents: v.number() })),
    concessionCostCents: v.number(),
    netValueCents: v.number(),
    floorCents: v.number(),
    marginOverFloorCents: v.number(),
    manipulationBlocked: v.number(),
  }),
  handler: async () => ({
    priceHeldCents: 1000,
    valueTraded: [
      { leverId: "freight_72h", costCents: 30000 },
      { leverId: "net_60", costCents: 9600 },
    ],
    concessionCostCents: 39600,
    netValueCents: 960400,
    floorCents: 800000,
    marginOverFloorCents: 160400,
    manipulationBlocked: 2,
  }),
});
