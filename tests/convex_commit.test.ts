import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "../convex/schema";
import { api, internal } from "../convex/_generated/api";

// Convex-LAYER integration tests: these run commitConcession, the verify gate, and the
// commit-safety A/B as REAL Convex transactions (in-memory via convex-test), not as
// pure-engine simulations. This closes the gap a reviewer flagged: the flagship floor
// claim was only asserted in pure TS. Here the mutation, the contended ledger head, the
// immutable concessionEntries, and the offer doc are all exercised end to end.
//
// Note on scope: convex-test executes the transaction model in a single-threaded
// simulation, so these prove the COMMIT LOGIC and the reconciliation invariant at the
// Convex layer. The naive-vs-guarded contrast holds here because the naive bug (never
// patching the head) breaches regardless of true parallelism; the live OCC retry under
// real concurrency is what harness.runRace demonstrates on the deployed backend.

// convex-test discovers the function modules via the bundler glob (tests live outside
// convex/). This Vite version doesn't support the extglob `!(*.*.*)` negation, so we
// glob broadly and drop the type-only .d.ts entries in JS.
const modules = Object.fromEntries(
  Object.entries(import.meta.glob("../convex/**/*.*s")).filter(([k]) => !k.endsWith(".d.ts"))
);

const FLOOR = 800000;
const LIST = 1000000;

describe("commitConcession — real Convex transaction", () => {
  it("commits a lever, holds list price, and clears the floor", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(api.seed.run, {});

    const r1 = await t.mutation(internal.negotiate.commitConcession, { negotiationId: "n1", leverId: "freight_72h" });
    expect(r1.accepted).toBe(true);
    expect(r1.netValueCents).toBe(970000); // 1,000,000 - 30,000
    expect(r1.netValueCents).toBeGreaterThanOrEqual(FLOOR);

    const r2 = await t.mutation(internal.negotiate.commitConcession, { negotiationId: "n1", leverId: "net_60" });
    expect(r2.accepted).toBe(true);
    expect(r2.netValueCents).toBe(960400); // - 9,600  => the $9,604 close
  });

  it("is idempotent: re-committing the same lever does not double-charge", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(api.seed.run, {});
    await t.mutation(internal.negotiate.commitConcession, { negotiationId: "n1", leverId: "freight_72h" });
    const again = await t.mutation(internal.negotiate.commitConcession, { negotiationId: "n1", leverId: "freight_72h" });
    expect(again.netValueCents).toBe(970000); // unchanged

    const entries = await t.run(async (ctx) =>
      ctx.db.query("concessionEntries").withIndex("by_negotiation", (q) => q.eq("negotiationId", "n1")).collect()
    );
    expect(entries.filter((e) => e.leverId === "freight_72h")).toHaveLength(1);
  });

  it("rejects a locked lever (account_pricing) until the buyer is verified", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(api.seed.run, {});

    const locked = await t.mutation(internal.negotiate.commitConcession, { negotiationId: "n1", leverId: "account_pricing" });
    expect(locked.accepted).toBe(false);
    expect(locked.netValueCents).toBe(LIST); // nothing committed

    // The verify gate unlocks it for THIS negotiation only.
    await t.mutation(internal.negotiate.setVerify, { negotiationId: "n1", accountUnlocked: true, verifyStatus: "verified: test whale" });
    const unlocked = await t.mutation(internal.negotiate.commitConcession, { negotiationId: "n1", leverId: "account_pricing" });
    expect(unlocked.accepted).toBe(true);
    expect(unlocked.netValueCents).toBe(950000); // 1,000,000 - 50,000, still above floor
    expect(unlocked.netValueCents).toBeGreaterThanOrEqual(FLOOR);
  });

  it("rejects a concession that would breach a raised floor (the clamp, at the Convex layer)", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(api.seed.run, {});
    // A judge raises the floor live via the control panel.
    await t.mutation(api.dealCard.update, { scenarioId: "deal-a", field: "floorCents", value: 980000 });

    // freight_72h costs 30,000 -> net 970,000 < 980,000 floor -> must be REFUSED.
    const r = await t.mutation(internal.negotiate.commitConcession, { negotiationId: "n1", leverId: "freight_72h" });
    expect(r.accepted).toBe(false);
    expect(r.netValueCents).toBe(LIST); // nothing committed; net stays at list, never below floor
  });

  it("reconciliation invariant: head.appliedCostCents == sum(concessionEntries)", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(api.seed.run, {});
    await t.mutation(internal.negotiate.commitConcession, { negotiationId: "n1", leverId: "freight_72h" });
    await t.mutation(internal.negotiate.commitConcession, { negotiationId: "n1", leverId: "net_60" });

    const { headCost, entrySum } = await t.run(async (ctx) => {
      const neg = await ctx.db.query("negotiation").withIndex("by_negotiation", (q) => q.eq("negotiationId", "n1")).unique();
      const head = await ctx.db.get(neg!.ledgerId);
      const entries = await ctx.db.query("concessionEntries").withIndex("by_negotiation", (q) => q.eq("negotiationId", "n1")).collect();
      return { headCost: head!.appliedCostCents, entrySum: entries.reduce((a, e) => a + e.costCents, 0) };
    });
    expect(headCost).toBe(entrySum);
    expect(headCost).toBe(39600);
  });
});

describe("commit-safety A/B — guarded holds the floor, naive breaches (real mutations)", () => {
  it("GUARDED: reads+patches the head, so the floor clamp rejects the over-budget concession", async () => {
    const t = convexTest(schema, modules);
    const key = "__test_guarded__";
    const ledgerId = await t.mutation(internal.harnessOps.reset, { key });
    // Fire K=8 concessions of $500; headroom is $2,000, so only 4 may land.
    await Promise.all(
      Array.from({ length: 8 }, () => t.mutation(internal.harnessOps.guardedCommit, { ledgerId, key, costCents: 50000 }))
    );
    const tally = await t.query(internal.harnessOps.tally, { key });
    expect(tally).toBeLessThanOrEqual(200000); // <= $2,000 of concessions
    expect(LIST - tally).toBeGreaterThanOrEqual(FLOOR); // net never breaches the floor
  });

  it("NAIVE: never patches the head, so every stale-checked concession lands and the floor breaches", async () => {
    const t = convexTest(schema, modules);
    const key = "__test_naive__";
    const ledgerId = await t.mutation(internal.harnessOps.reset, { key });
    await Promise.all(
      Array.from({ length: 8 }, () => t.mutation(internal.harnessOps.naiveCommit, { ledgerId, key, costCents: 50000 }))
    );
    const tally = await t.query(internal.harnessOps.tally, { key });
    expect(tally).toBeGreaterThan(200000); // overshoots the headroom
    expect(LIST - tally).toBeLessThan(FLOOR); // the floor is breached — exactly what the panel shows
  });
});
