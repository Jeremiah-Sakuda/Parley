import { query, mutation, internalMutation } from "./_generated/server";
import { api } from "./_generated/api";
import { v } from "convex/values";

const messageValidator = v.object({
  role: v.string(),
  text: v.string(),
  isProbe: v.boolean(),
  confidence: v.number(),
});

// Real impl (Sprint 3): the chat transcript for this negotiation.
export const list = query({
  args: { negotiationId: v.string() },
  returns: v.array(messageValidator),
  handler: async (ctx, { negotiationId }) => {
    const docs = await ctx.db
      .query("messages")
      .withIndex("by_negotiation", (q) => q.eq("negotiationId", negotiationId))
      .collect();
    return docs.map((m) => ({
      role: m.role,
      text: m.text,
      isProbe: m.isProbe,
      confidence: m.confidence,
    }));
  },
});

// Inserts the buyer turn and schedules the seller's agent.respond. The reply appears
// reactively via list() — the UI never calls the action directly.
export const sendBuyer = mutation({
  args: { negotiationId: v.string(), text: v.string() },
  returns: v.null(),
  handler: async (ctx, { negotiationId, text }) => {
    await ctx.db.insert("messages", {
      negotiationId,
      role: "buyer",
      text,
      isProbe: false,
      confidence: 0,
    });
    await ctx.scheduler.runAfter(0, api.agent.respond, { negotiationId, buyerText: text });
    return null;
  },
});

// Internal: only the agent action writes seller turns (with the probe flag +
// constraint confidence that drive the UI's probe tag / confidence strip).
export const appendSeller = internalMutation({
  args: {
    negotiationId: v.string(),
    text: v.string(),
    isProbe: v.boolean(),
    confidence: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, { negotiationId, text, isProbe, confidence }) => {
    await ctx.db.insert("messages", {
      negotiationId,
      role: "seller",
      text,
      isProbe,
      confidence,
    });
    return null;
  },
});
