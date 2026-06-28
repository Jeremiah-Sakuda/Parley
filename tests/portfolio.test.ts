import { describe, it, expect } from "vitest";
import { portfolioImpact, SEED_LEADS } from "../convex/engine/qualify";
import { DEAL_A } from "../convex/engine/fixtures";

// The aggregate ROI number, on the seeded portfolio. Pursued = l1 Walmart (1400, PURSUE),
// l2 Northgate (860, WATCH), l4 Bayside (1000, PURSUE); l3 Corner Market (300) is SKIPped.
describe("portfolioImpact — margin held vs a competitor-matching discounter", () => {
  it("totals the close forward over the seeded leads", () => {
    const p = portfolioImpact(DEAL_A, SEED_LEADS);
    expect(p.dealsConsidered).toBe(4);
    expect(p.dealsPursued).toBe(3);
    expect(p.dealsSkipped).toBe(1);
    expect(p.unitsPursued).toBe(3260);
    // Parley closes at full price + the matching lever on each pursued deal.
    expect(p.parleyNetCents).toBe(1370000 + 850400 + 980000); // 3,200,400
    // A discounter matches the competitor's $8/unit to win each deal.
    expect(p.discounterPricePerUnitCents).toBe(800);
    expect(p.discounterNetCents).toBe(3260 * 800); // 2,608,000
    expect(p.marginHeldCents).toBe(592400); // $5,924 held that a discounter gives away
  });

  it("margin held is always non-negative (Parley never nets below a discounter)", () => {
    const p = portfolioImpact(DEAL_A, SEED_LEADS);
    expect(p.marginHeldCents).toBeGreaterThanOrEqual(0);
    expect(p.parleyNetCents).toBeGreaterThanOrEqual(p.discounterNetCents);
  });
});
