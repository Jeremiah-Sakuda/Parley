import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { DEAL_A, DEAL_B } from "./engine/fixtures";
import { listTotal } from "./engine/clamp";
import type { DealCard } from "./engine/types";
import type { MutationCtx } from "./_generated/server";

// Idempotent dev seed: upserts both deal cards and creates negotiation "n1" at full
// price with an empty ledger head. Run once with `npx convex run seed:run`.
async function upsertCard(ctx: MutationCtx, card: DealCard) {
  const existing = await ctx.db
    .query("dealCards")
    .withIndex("by_scenario", (q) => q.eq("scenarioId", card.scenarioId))
    .unique();
  if (existing) await ctx.db.patch(existing._id, { ...card });
  else await ctx.db.insert("dealCards", { ...card });
}

export const run = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    await upsertCard(ctx, DEAL_A);
    await upsertCard(ctx, DEAL_B);

    const existing = await ctx.db
      .query("negotiation")
      .withIndex("by_negotiation", (q) => q.eq("negotiationId", "n1"))
      .unique();
    if (!existing) {
      const card = DEAL_A;
      const ledgerId = await ctx.db.insert("negotiationLedger", {
        negotiationId: "n1",
        listTotalCents: listTotal(card),
        appliedCostCents: 0,
        floorCents: card.floorCents,
        version: 0,
      });
      await ctx.db.insert("negotiation", {
        negotiationId: "n1",
        scenarioId: "deal-a",
        status: "proposing",
        ledgerId,
        manipulationBlocked: 0,
      });
      await ctx.db.insert("offers", {
        negotiationId: "n1",
        pricePerUnitCents: card.listPriceCents,
        units: card.units,
        appliedLevers: [],
        netValueCents: listTotal(card),
        floorCents: card.floorCents,
        status: "accepted",
      });
    }
    return null;
  },
});
