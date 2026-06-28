import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

// Internal ops for the commit-safety A/B. Each run operates on its OWN ledger `key`
// (e.g. "__harness_naive__" vs "__harness_guarded__") so the panel can run both modes
// in parallel with ZERO cross-contamination. (The public action lives in harness.ts.)

export const LIST_TOTAL = 1_000_000; // $10,000
export const FLOOR = 800_000; // $8,000 → $2,000 of headroom
export const CONCESSION = 50_000; // $500 per concession; 4 fit, the rest must be rejected
export const K = 8; // concurrent concessions fired

export const reset = internalMutation({
  args: { key: v.string() },
  returns: v.id("negotiationLedger"),
  handler: async (ctx, { key }) => {
    for (const e of await ctx.db
      .query("concessionEntries")
      .withIndex("by_negotiation", (q) => q.eq("negotiationId", key))
      .collect())
      await ctx.db.delete(e._id);
    const existing = await ctx.db
      .query("negotiationLedger")
      .withIndex("by_negotiation", (q) => q.eq("negotiationId", key))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, {
        appliedCostCents: 0,
        listTotalCents: LIST_TOTAL,
        floorCents: FLOOR,
        version: existing.version + 1,
      });
      return existing._id;
    }
    return await ctx.db.insert("negotiationLedger", {
      negotiationId: key,
      listTotalCents: LIST_TOTAL,
      appliedCostCents: 0,
      floorCents: FLOOR,
      version: 0,
    });
  },
});

// GUARDED: read + patch the SAME head. Concurrent writers contend → Convex's
// serializable OCC aborts + auto-retries the loser → the floor clamp holds the line.
export const guardedCommit = internalMutation({
  args: { ledgerId: v.id("negotiationLedger"), key: v.string(), costCents: v.number() },
  returns: v.boolean(),
  handler: async (ctx, { ledgerId, key, costCents }) => {
    const head = await ctx.db.get(ledgerId);
    if (!head) return false;
    if (head.listTotalCents - (head.appliedCostCents + costCents) < head.floorCents) {
      return false; // would breach → reject (the floor holding)
    }
    await ctx.db.insert("concessionEntries", {
      negotiationId: key,
      leverId: "harness",
      costCents,
      version: head.version,
    });
    await ctx.db.patch(ledgerId, {
      appliedCostCents: head.appliedCostCents + costCents,
      version: head.version + 1,
    });
    return true;
  },
});

// NAIVE: check the floor against the head's STALE cached total, then write to a
// DIFFERENT document (insert an entry) WITHOUT patching the head → no read/write-set
// overlap, the head never updates, every concession passes the stale check → BREACH.
export const naiveCommit = internalMutation({
  args: { ledgerId: v.id("negotiationLedger"), key: v.string(), costCents: v.number() },
  returns: v.boolean(),
  handler: async (ctx, { ledgerId, key, costCents }) => {
    const head = await ctx.db.get(ledgerId);
    if (!head) return false;
    if (head.listTotalCents - (head.appliedCostCents + costCents) < head.floorCents) {
      return false;
    }
    await ctx.db.insert("concessionEntries", {
      negotiationId: key,
      leverId: "harness",
      costCents,
      version: head.version,
    });
    // The deliberate bug: the head is never patched, so its cached total goes stale.
    return true;
  },
});

export const tally = internalQuery({
  args: { key: v.string() },
  returns: v.number(),
  handler: async (ctx, { key }) => {
    const entries = await ctx.db
      .query("concessionEntries")
      .withIndex("by_negotiation", (q) => q.eq("negotiationId", key))
      .collect();
    return entries.reduce((a, e) => a + e.costCents, 0);
  },
});
