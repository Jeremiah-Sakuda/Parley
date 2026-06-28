import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { loadCard } from "./lib/cards";
import { listTotal } from "./engine/clamp";
import { deriveLive, applyConcession } from "./engine/ledger";

// Real impl (Sprint 2): liveState derives net from the CURRENT deal card + committed
// concession entries, so a control-panel edit re-solves the meter with no extra
// wiring. Numbers come only from the engine, never the LLM.
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
    const appliedCost = entries.reduce((a, e) => a + e.costCents, 0);
    const appliedLevers = entries.map((e) => e.leverId);
    const d = deriveLive(card, appliedCost, appliedLevers.length);
    return {
      status: d.status,
      netValueCents: d.netValueCents,
      floorCents: d.floorCents,
      pricePerUnitCents: card.listPriceCents,
      units: card.units,
      appliedLevers,
      marginOverFloorCents: d.marginOverFloorCents,
      manipulationBlocked: neg?.manipulationBlocked ?? 0,
      mouthGuardOverridden: false,
    };
  },
});

// The guarded commit (the write-skew-immune core). It READS the contended ledger
// head and PATCHES the SAME doc, so two concurrent concessions land in each other's
// read/write set and Convex's serializable OCC aborts + auto-retries the loser
// against fresh state. A concession is applied only if it still clears the floor;
// entry insertion is idempotent on (negotiationId, leverId). Called by the agent
// (Sprint 3) and the race harness (Sprint 6).
export const commitConcession = mutation({
  args: { negotiationId: v.string(), leverId: v.string() },
  returns: v.object({
    accepted: v.boolean(),
    netValueCents: v.number(),
    status: v.string(),
  }),
  handler: async (ctx, { negotiationId, leverId }) => {
    const neg = await ctx.db
      .query("negotiation")
      .withIndex("by_negotiation", (q) => q.eq("negotiationId", negotiationId))
      .unique();
    if (!neg) throw new Error(`negotiation ${negotiationId} not found (run seed:run)`);
    const head = await ctx.db.get(neg.ledgerId); // READ the contended head → read set
    if (!head) throw new Error("ledger head missing");
    const card = await loadCard(ctx, neg.scenarioId);

    const entries = await ctx.db
      .query("concessionEntries")
      .withIndex("by_negotiation", (q) => q.eq("negotiationId", negotiationId))
      .collect();

    // Idempotency: re-applying a lever (e.g. on an OCC auto-retry) is a no-op.
    if (entries.some((e) => e.leverId === leverId)) {
      const net = listTotal(card) - head.appliedCostCents;
      return { accepted: true, netValueCents: net, status: net >= card.floorCents ? "accepted" : "counter" };
    }

    const r = applyConcession(card, head.appliedCostCents, leverId);
    if (!r.accepted) {
      const net = listTotal(card) - head.appliedCostCents;
      return { accepted: false, netValueCents: net, status: "counter" };
    }

    await ctx.db.insert("concessionEntries", {
      negotiationId,
      leverId,
      costCents: r.costCents,
      version: head.version,
    });
    await ctx.db.patch(head._id, {
      appliedCostCents: r.newAppliedCostCents, // PATCH the same head → write set overlaps
      version: head.version + 1,
    });

    const net = listTotal(card) - r.newAppliedCostCents;
    const appliedLevers = [...entries.map((e) => e.leverId), leverId];
    const status = net >= card.floorCents ? "accepted" : "counter";
    const offer = await ctx.db
      .query("offers")
      .withIndex("by_negotiation", (q) => q.eq("negotiationId", negotiationId))
      .first();
    const offerData = {
      negotiationId,
      pricePerUnitCents: card.listPriceCents,
      units: card.units,
      appliedLevers,
      netValueCents: net,
      floorCents: card.floorCents,
      status,
    };
    if (offer) await ctx.db.patch(offer._id, offerData);
    else await ctx.db.insert("offers", offerData);
    await ctx.db.patch(neg._id, { status: net >= card.floorCents ? "closing" : "refusing" });

    return { accepted: true, netValueCents: net, status: "accepted" };
  },
});
