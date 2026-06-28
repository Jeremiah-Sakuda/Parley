import { query } from "./_generated/server";
import { v } from "convex/values";

// Real impl (Sprint 2): the standing offer is whatever the engine commit last wrote.
// The UI renders numbers ONLY from here — never from chat/LLM text.
const offerValidator = v.object({
  negotiationId: v.string(),
  pricePerUnitCents: v.number(),
  units: v.number(),
  appliedLevers: v.array(v.string()),
  netValueCents: v.number(),
  floorCents: v.number(),
  status: v.string(),
});

export const current = query({
  args: { negotiationId: v.string() },
  returns: v.union(offerValidator, v.null()),
  handler: async (ctx, { negotiationId }) => {
    const doc = await ctx.db
      .query("offers")
      .withIndex("by_negotiation", (q) => q.eq("negotiationId", negotiationId))
      .first();
    if (!doc) return null;
    const { _id, _creationTime, ...offer } = doc;
    return offer;
  },
});

export const list = query({
  args: { negotiationId: v.string() },
  returns: v.array(offerValidator),
  handler: async (ctx, { negotiationId }) => {
    const docs = await ctx.db
      .query("offers")
      .withIndex("by_negotiation", (q) => q.eq("negotiationId", negotiationId))
      .collect();
    return docs.map(({ _id, _creationTime, ...offer }) => offer);
  },
});
