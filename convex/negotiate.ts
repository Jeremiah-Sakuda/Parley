import { query } from "./_generated/server";
import { v } from "convex/values";

// STUB (Sprint 0): returns the live-state fixture (Deal A clean close). Real impl
// (Sprint 2) derives this reactively from the negotiationLedger head + offers.
export const liveState = query({
  args: { negotiationId: v.string() },
  returns: v.object({
    status: v.string(),
    netValueCents: v.number(),
    floorCents: v.number(),
    pricePerUnitCents: v.number(),
    units: v.number(),
    appliedLevers: v.array(v.string()),
    marginOverFloorCents: v.number(),
    manipulationBlocked: v.number(),
    mouthGuardOverridden: v.boolean(),
  }),
  handler: async () => ({
    status: "proposing",
    netValueCents: 960400,
    floorCents: 800000,
    pricePerUnitCents: 1000,
    units: 1000,
    appliedLevers: ["freight_72h", "net_60"],
    marginOverFloorCents: 160400,
    manipulationBlocked: 0,
    mouthGuardOverridden: false,
  }),
});
