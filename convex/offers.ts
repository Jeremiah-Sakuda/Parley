import { query } from "./_generated/server";
import { v } from "convex/values";

// STUB (Sprint 0): the Deal A clean-close offer. Real impl (Sprint 2) reads the
// offers table written by the engine commit mutation. Numbers come ONLY from here.
const offerValidator = v.object({
  negotiationId: v.string(),
  pricePerUnitCents: v.number(),
  units: v.number(),
  appliedLevers: v.array(v.string()),
  netValueCents: v.number(),
  floorCents: v.number(),
  status: v.string(),
});

const FIXTURE = {
  negotiationId: "n1",
  pricePerUnitCents: 1000,
  units: 1000,
  appliedLevers: ["freight_72h", "net_60"],
  netValueCents: 960400,
  floorCents: 800000,
  status: "accepted",
};

export const current = query({
  args: { negotiationId: v.string() },
  returns: v.union(offerValidator, v.null()),
  handler: async () => FIXTURE,
});

export const list = query({
  args: { negotiationId: v.string() },
  returns: v.array(offerValidator),
  handler: async () => [FIXTURE],
});
