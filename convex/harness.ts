import { action } from "./_generated/server";
import { v } from "convex/values";

// STUB (Sprint 0): fixture race results. Real impl (Sprint 6, gated) runs the
// deterministic concurrent-concession driver: the NAIVE commit (reads a stale
// cached scalar, writes a different doc) breaches the floor; the GUARDED commit
// (reads+patches the contended ledger head) holds. Honest commit-safety A/B of our
// OWN engine — never a competitor race.
export const runRace = action({
  args: {
    negotiationId: v.string(),
    mode: v.union(v.literal("naive"), v.literal("guarded")),
  },
  returns: v.object({
    mode: v.string(),
    finalNetCents: v.number(),
    floorCents: v.number(),
    breached: v.boolean(),
    conflicts: v.number(),
    attempts: v.number(),
  }),
  handler: async (_ctx, args) => {
    if (args.mode === "naive") {
      return { mode: "naive", finalNetCents: 772000, floorCents: 800000, breached: true, conflicts: 0, attempts: 6 };
    }
    return { mode: "guarded", finalNetCents: 800000, floorCents: 800000, breached: false, conflicts: 4, attempts: 10 };
  },
});
