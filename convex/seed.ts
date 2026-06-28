import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { DEAL_A, DEAL_B } from "./engine/fixtures";
import { listTotal } from "./engine/clamp";
import { loadCard } from "./lib/cards";
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

// Reset a negotiation to its opening state: clear concessions + messages, reset the
// ledger head + offer to full price. Used for clean demo runs and tests.
export const reset = mutation({
  args: { negotiationId: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, { negotiationId }) => {
    const id = negotiationId ?? "n1";
    for (const e of await ctx.db
      .query("concessionEntries")
      .withIndex("by_negotiation", (q) => q.eq("negotiationId", id))
      .collect())
      await ctx.db.delete(e._id);
    for (const m of await ctx.db
      .query("messages")
      .withIndex("by_negotiation", (q) => q.eq("negotiationId", id))
      .collect())
      await ctx.db.delete(m._id);

    const neg = await ctx.db
      .query("negotiation")
      .withIndex("by_negotiation", (q) => q.eq("negotiationId", id))
      .unique();
    if (!neg) return null;
    const card = await loadCard(ctx, neg.scenarioId);
    const head = await ctx.db.get(neg.ledgerId);
    if (head)
      await ctx.db.patch(head._id, {
        appliedCostCents: 0,
        listTotalCents: listTotal(card),
        floorCents: card.floorCents,
        version: head.version + 1,
      });
    const offer = await ctx.db
      .query("offers")
      .withIndex("by_negotiation", (q) => q.eq("negotiationId", id))
      .first();
    if (offer)
      await ctx.db.patch(offer._id, {
        pricePerUnitCents: card.listPriceCents,
        units: card.units,
        appliedLevers: [],
        netValueCents: listTotal(card),
        floorCents: card.floorCents,
        status: "accepted",
      });
    await ctx.db.patch(neg._id, { status: "proposing", manipulationBlocked: 0 });
    return null;
  },
});
