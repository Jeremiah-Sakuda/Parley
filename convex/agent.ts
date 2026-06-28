import { action } from "./_generated/server";
import { v } from "convex/values";

// STUB (Sprint 0): no-op. Real impl (Sprint 3) calls OpenAI with strict structured
// output to get an LLMProposal, runs the engine mutation (which clamps + commits),
// and writes the offer + seller message. The LLM proposes; only the engine commits.
export const respond = action({
  args: { negotiationId: v.string(), buyerText: v.string() },
  returns: v.null(),
  handler: async () => null,
});
