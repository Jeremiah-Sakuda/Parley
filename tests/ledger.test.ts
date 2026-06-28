import { describe, it, expect } from "vitest";
import { deriveLive, applyConcession, reconcile } from "../convex/engine/ledger";
import { listTotal } from "../convex/engine/clamp";
import { DEAL_A } from "../convex/engine/fixtures";
import type { DealCard } from "../convex/engine/types";

const unlocked = (card: DealCard): DealCard => ({
  ...card,
  levers: card.levers.map((l) => ({ ...l, locked: false })),
});

describe("deriveLive (the reactive meter math)", () => {
  it("at full price with no concessions, net = list total and status is proposing", () => {
    const d = deriveLive(DEAL_A, 0, 0);
    expect(d.netValueCents).toBe(listTotal(DEAL_A));
    expect(d.status).toBe("proposing");
    expect(d.marginOverFloorCents).toBe(listTotal(DEAL_A) - DEAL_A.floorCents);
  });

  it("with a concession applied, net drops and status is closing", () => {
    const d = deriveLive(DEAL_A, 30000, 1);
    expect(d.netValueCents).toBe(970000);
    expect(d.status).toBe("closing");
  });

  it("raising the floor above net flips the live state to refusing (the floor-edit demo)", () => {
    const card: DealCard = { ...DEAL_A, floorCents: 1_100_000 };
    const d = deriveLive(card, 0, 0);
    expect(d.status).toBe("refusing");
    expect(d.marginOverFloorCents).toBeLessThan(0);
  });
});

describe("applyConcession (the contended commit's decision)", () => {
  it("applies a lever that still clears the floor", () => {
    const r = applyConcession(DEAL_A, 0, "freight_72h");
    expect(r.accepted).toBe(true);
    expect(r.newAppliedCostCents).toBe(30000);
  });

  it("refuses a locked lever", () => {
    const r = applyConcession(DEAL_A, 0, "account_pricing");
    expect(r.accepted).toBe(false);
    expect(r.reason).toBe("unavailable");
  });

  it("refuses a concession that would breach the floor, leaving cost unchanged", () => {
    const card: DealCard = { ...unlocked(DEAL_A), floorCents: 980000 };
    const r = applyConcession(card, 0, "account_pricing"); // cost 50000 → net 950000 < 980000
    expect(r.accepted).toBe(false);
    expect(r.reason).toBe("breaches_floor");
    expect(r.newAppliedCostCents).toBe(0);
  });
});

describe("reconcile (cache vs immutable ledger)", () => {
  it("holds when the head equals the sum of entries", () => {
    expect(reconcile([30000, 9600], 39600)).toBe(true);
  });
  it("fails when the cache drifts from the entries", () => {
    expect(reconcile([30000], 39600)).toBe(false);
  });
});
