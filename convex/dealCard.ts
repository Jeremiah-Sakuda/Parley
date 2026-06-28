import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { loadCard } from "./lib/cards";
import { listTotal } from "./engine/clamp";
import type { DealCard } from "./engine/types";
import type { MutationCtx } from "./_generated/server";

// Apply a dot-path update to a plain object (e.g. "levers.0.costCents",
// "competitor.shipDays"). Mirrors the client-side patchField so server + client agree.
function patchPath<T>(obj: T, path: string, value: unknown): T {
  const clone = JSON.parse(JSON.stringify(obj));
  const keys = path.split(".");
  let cur: Record<string, unknown> = clone;
  for (let i = 0; i < keys.length - 1; i++) {
    cur = cur[keys[i]!] as Record<string, unknown>;
  }
  cur[keys[keys.length - 1]!] = value;
  return clone as T;
}

// When the card's economics change, re-sync each negotiation on that scenario: the
// ledger head's floor/list and the standing offer + status. liveState already reads
// the live card, so the meter re-solves on its own — this keeps the offer row and
// negotiation.status consistent with it.
async function resync(ctx: MutationCtx, scenarioId: string, card: DealCard) {
  const negs = await ctx.db
    .query("negotiation")
    .withIndex("by_scenario", (q) => q.eq("scenarioId", scenarioId))
    .collect();
  for (const neg of negs) {
    const head = await ctx.db.get(neg.ledgerId);
    if (head) {
      await ctx.db.patch(head._id, {
        listTotalCents: listTotal(card),
        floorCents: card.floorCents,
      });
    }
    const entries = await ctx.db
      .query("concessionEntries")
      .withIndex("by_negotiation", (q) => q.eq("negotiationId", neg.negotiationId))
      .collect();
    const appliedCost = entries.reduce((a, e) => a + e.costCents, 0);
    const net = listTotal(card) - appliedCost;
    const offer = await ctx.db
      .query("offers")
      .withIndex("by_negotiation", (q) => q.eq("negotiationId", neg.negotiationId))
      .first();
    if (offer) {
      await ctx.db.patch(offer._id, {
        pricePerUnitCents: card.listPriceCents,
        units: card.units,
        netValueCents: net,
        floorCents: card.floorCents,
        status: net >= card.floorCents ? "accepted" : "counter",
      });
    }
    await ctx.db.patch(neg._id, {
      status: net < card.floorCents ? "refusing" : appliedCost > 0 ? "closing" : "proposing",
    });
  }
}

// Real impl (Sprint 2): patch the live deal card by dot-path field (upserting from
// the fixture on first edit), then re-solve dependent negotiations. This is the
// "it's not hardcoded" demo — a judge edits the floor and the meter flips live.
export const update = mutation({
  args: { scenarioId: v.string(), field: v.string(), value: v.any() },
  returns: v.null(),
  handler: async (ctx, { scenarioId, field, value }) => {
    let doc = await ctx.db
      .query("dealCards")
      .withIndex("by_scenario", (q) => q.eq("scenarioId", scenarioId))
      .unique();
    if (!doc) {
      const fixture = await loadCard(ctx, scenarioId);
      const id = await ctx.db.insert("dealCards", { ...fixture });
      doc = await ctx.db.get(id);
    }
    const { _id, _creationTime, ...card } = doc!;
    const patched = patchPath(card as DealCard, field, value);
    await ctx.db.patch(_id, patched);
    await resync(ctx, scenarioId, patched);
    return null;
  },
});
