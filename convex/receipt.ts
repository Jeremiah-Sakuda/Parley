import { query } from "./_generated/server";
import { v } from "convex/values";
import { loadCard } from "./lib/cards";
import { listTotal } from "./engine/clamp";

// Real impl (Sprint 5): the receipt aggregates the immutable concessionEntries + the
// manipulationLog count — never the LLM transcript. Net reconciles to list − Σ costs.
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
  handler: async (ctx, { negotiationId }) => {
    const neg = await ctx.db
      .query("negotiation")
      .withIndex("by_negotiation", (q) => q.eq("negotiationId", negotiationId))
      .unique();
    const card = await loadCard(ctx, neg?.scenarioId ?? "deal-a");
    const entries = neg
      ? await ctx.db
          .query("concessionEntries")
          .withIndex("by_negotiation", (q) => q.eq("negotiationId", negotiationId))
          .collect()
      : [];
    const valueTraded = entries.map((e) => ({ leverId: e.leverId, costCents: e.costCents }));
    const concessionCostCents = entries.reduce((a, e) => a + e.costCents, 0);
    const netValueCents = listTotal(card) - concessionCostCents;
    return {
      priceHeldCents: card.listPriceCents,
      valueTraded,
      concessionCostCents,
      netValueCents,
      floorCents: card.floorCents,
      marginOverFloorCents: netValueCents - card.floorCents,
      manipulationBlocked: neg?.manipulationBlocked ?? 0,
    };
  },
});
