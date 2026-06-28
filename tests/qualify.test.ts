import { describe, it, expect } from "vitest";
import { qualify, SEED_LEADS, type Lead } from "../convex/engine/qualify";
import { DEAL_A } from "../convex/engine/fixtures";

const lead = (over: Partial<Lead>): Lead => ({
  id: "x",
  company: "X",
  estUnits: 1000,
  likelyPriority: "speed",
  source: "seed",
  ...over,
});

describe("qualify() — the close's net-value math run forward", () => {
  it("PURSUE: a big lead clears the floor with room", () => {
    const v = qualify(lead({ estUnits: 1400, likelyPriority: "speed" }), DEAL_A);
    expect(v.decision).toBe("PURSUE");
    expect(v.headroomCents).toBeGreaterThan(0);
  });

  it("WATCH: a lead that clears the floor but only thinly", () => {
    const v = qualify(lead({ estUnits: 860, likelyPriority: "cash_flow" }), DEAL_A);
    expect(v.decision).toBe("WATCH");
  });

  it("SKIP (the hero): a lead below the minimum viable size", () => {
    const v = qualify(lead({ estUnits: 300, likelyPriority: "speed" }), DEAL_A);
    expect(v.decision).toBe("SKIP");
    expect(v.reason).toMatch(/too small|units/);
  });

  it("SKIP: a mid-size lead that still can't clear the floor", () => {
    const v = qualify(lead({ estUnits: 700, likelyPriority: "speed" }), DEAL_A);
    expect(v.decision).toBe("SKIP");
    expect(v.reason).toMatch(/can't clear the floor/);
  });

  it("uses the SAME constant floor for every lead (never a per-lead floor)", () => {
    for (const l of SEED_LEADS) {
      const v = qualify(l, DEAL_A);
      if (v.decision !== "SKIP" || v.headroomCents !== 0) {
        expect(v.headroomCents).toBe(v.netAtFloorCents - DEAL_A.floorCents);
      }
    }
  });

  it("the seeded pipeline gives a demoable mix of verdicts", () => {
    const decisions = SEED_LEADS.map((l) => qualify(l, DEAL_A).decision);
    expect(decisions).toContain("PURSUE");
    expect(decisions).toContain("WATCH");
    expect(decisions).toContain("SKIP");
  });
});
