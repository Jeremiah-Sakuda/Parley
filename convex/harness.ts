import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { LIST_TOTAL, FLOOR, CONCESSION, K } from "./harnessOps";

// The commit-safety A/B (the Technical-Complexity flex): two implementations of the
// SAME engine's commit, run as REAL Convex transactions on a dedicated harness ledger.
// NAIVE (stale cache + write a different doc) breaches the floor; GUARDED (read+patch
// the one contended head) holds it. The "opponent" is concurrency, not a competitor —
// this is our own engine, two ways.
export const runRace = action({
  args: {
    negotiationId: v.string(),
    mode: v.union(v.literal("naive"), v.literal("guarded")),
    // Number of concurrent concessions to fire. Defaults to K; raise it (up to 64) to
    // stress real OCC contention on the deployed backend (the panel's "N-client race").
    k: v.optional(v.number()),
  },
  returns: v.object({
    mode: v.string(),
    finalNetCents: v.number(),
    floorCents: v.number(),
    breached: v.boolean(),
    rejected: v.number(),
    attempts: v.number(),
  }),
  handler: async (
    ctx,
    { mode, k }
  ): Promise<{
    mode: string;
    finalNetCents: number;
    floorCents: number;
    breached: boolean;
    rejected: number;
    attempts: number;
  }> => {
    const count = Math.min(Math.max(Math.trunc(k ?? K), 1), 64);
    // Each mode runs on its OWN ledger key, so naive + guarded can run in parallel
    // (as the panel does) without contaminating each other's tally.
    const key = `__harness_${mode}__`;
    const ledgerId = await ctx.runMutation(internal.harnessOps.reset, { key });
    // Fire `count` concessions CONCURRENTLY at this mode's ledger. They contend on the one
    // head; on the deployed backend Convex's serializable OCC aborts + retries the losers.
    const results = await Promise.all(
      Array.from({ length: count }, () =>
        mode === "naive"
          ? ctx.runMutation(internal.harnessOps.naiveCommit, { ledgerId, key, costCents: CONCESSION })
          : ctx.runMutation(internal.harnessOps.guardedCommit, { ledgerId, key, costCents: CONCESSION })
      )
    );
    const accepted = results.filter(Boolean).length;
    const appliedCostCents = await ctx.runQuery(internal.harnessOps.tally, { key });
    const finalNetCents = LIST_TOTAL - appliedCostCents;
    return {
      mode,
      finalNetCents,
      floorCents: FLOOR,
      breached: finalNetCents < FLOOR,
      // Concessions the floor clamp rejected (0 for naive, which never re-checks the
      // updated head). This counts floor-rejections, not OCC aborts; the real OCC retry
      // happens live when these mutations contend on the one head on the deployed backend
      // (convex-test runs single-threaded, so it can't surface aborts).
      rejected: count - accepted,
      attempts: count,
    };
  },
});
