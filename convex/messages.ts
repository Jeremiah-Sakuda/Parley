import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

const messageValidator = v.object({
  role: v.string(),
  text: v.string(),
  isProbe: v.boolean(),
  confidence: v.number(),
});

// STUB (Sprint 0): a sample Deal B opening (buyer pushes on price, seller probes).
// Real impl (Sprint 3) reads the messages table for this negotiation.
export const list = query({
  args: { negotiationId: v.string() },
  returns: v.array(messageValidator),
  handler: async () => [
    { role: "buyer", text: "Your price is too high.", isProbe: false, confidence: 0 },
    { role: "seller", text: "What's driving the timeline on your end?", isProbe: true, confidence: 0.2 },
  ],
});

// STUB (Sprint 0): no-op. Real impl (Sprint 3) inserts the buyer message and
// schedules agent.respond (LLM proposes → engine commits → seller reply appears).
export const sendBuyer = mutation({
  args: { negotiationId: v.string(), text: v.string() },
  returns: v.null(),
  handler: async () => null,
});
