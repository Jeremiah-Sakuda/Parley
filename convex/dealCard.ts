import { mutation } from "./_generated/server";
import { v } from "convex/values";

// STUB (Sprint 0): no-op. Real impl (Sprint 2) patches the dealCards doc by field
// so the control panel edits the live deal card (the "it's not hardcoded" demo).
export const update = mutation({
  args: { scenarioId: v.string(), field: v.string(), value: v.any() },
  returns: v.null(),
  handler: async () => null,
});
