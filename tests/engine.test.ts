import { describe, it, expect } from "vitest";
import { clampOffer, listTotal, leverCostCents } from "../convex/engine/clamp";
import { selectLevers, DISCOVERY_CONFIDENCE } from "../convex/engine/levers";
import { checkClaim } from "../convex/engine/grounding";
import { solve } from "../convex/engine/index";
import { DEAL_A } from "../convex/engine/fixtures";
import type { DealCard } from "../convex/engine/types";

// Tests live OUTSIDE convex/ so the Convex bundler never touches them. They import
// the pure engine directly — the SAME code the production mutation runs.

const unlocked = (card: DealCard): DealCard => ({
  ...card,
  levers: card.levers.map((l) => ({ ...l, locked: false })),
});

describe("net-value clamp (T1–T9)", () => {
  it("T1: clean close (freight + net-60) accepts at list, net = $9,604", () => {
    const r = clampOffer(DEAL_A, ["freight_72h", "net_60"], null);
    expect(r.status).toBe("accepted");
    expect(r.pricePerUnitCents).toBe(1000);
    expect(r.netValueCents).toBe(960400);
    // anchor: reconciles to list total minus the two lever costs
    expect(r.netValueCents).toBe(
      listTotal(DEAL_A) - leverCostCents(DEAL_A, ["freight_72h", "net_60"])
    );
  });

  it("T2: a single value lever still holds", () => {
    const r = clampOffer(DEAL_A, ["freight_72h"], null);
    expect(r.status).toBe("accepted");
    expect(r.netValueCents).toBe(970000);
  });

  it("T3: price attack ($8/unit) is countered at list, not granted", () => {
    const r = clampOffer(DEAL_A, ["freight_72h", "net_60"], 800);
    expect(r.status).toBe("counter");
    expect(r.breachKind).toBe("price_breach");
    expect(r.pricePerUnitCents).toBe(1000);
    expect(r.netValueCents).toBe(960400);
  });

  it("T4: value back-door (giveaway stack breaches at list) drops the costliest levers", () => {
    const card: DealCard = { ...unlocked(DEAL_A), floorCents: 950000 };
    const r = clampOffer(
      card,
      ["account_pricing", "freight_72h", "defect_guarantee", "net_60"],
      null
    );
    expect(r.status).toBe("counter");
    expect(r.breachKind).toBe("value_backdoor");
    expect(r.netValueCents).toBeGreaterThanOrEqual(950000);
    expect(r.droppedLevers).toContain("account_pricing"); // most expensive dropped first
  });

  it("T5: a locked lever (account_pricing) is rejected, not granted", () => {
    const r = clampOffer(DEAL_A, ["account_pricing"], null);
    expect(r.rejectedLevers).toContain("account_pricing");
    expect(r.appliedLevers).not.toContain("account_pricing");
    expect(r.status).toBe("accepted"); // nothing granted, list price holds
  });

  it("T6: an unknown lever is rejected", () => {
    const r = clampOffer(DEAL_A, ["free_unicorn"], null);
    expect(r.rejectedLevers).toContain("free_unicorn");
    expect(r.appliedLevers).toHaveLength(0);
  });

  it("T7: net exactly at the floor ACCEPTS (>= boundary)", () => {
    const card: DealCard = { ...DEAL_A, floorCents: 970000 };
    const r = clampOffer(card, ["freight_72h"], null);
    expect(r.netValueCents).toBe(970000);
    expect(r.status).toBe("accepted");
  });

  it("T8: net one cent below the floor COUNTERS", () => {
    const card: DealCard = { ...DEAL_A, floorCents: 970001 };
    const r = clampOffer(card, ["freight_72h"], null);
    expect(r.status).toBe("counter");
    expect(r.appliedLevers).not.toContain("freight_72h"); // dropped to hold the floor
  });

  it("T9: the full affordable stack holds at the default floor", () => {
    const r = clampOffer(
      unlocked(DEAL_A),
      ["freight_72h", "net_60", "defect_guarantee", "account_pricing"],
      null
    );
    expect(r.status).toBe("accepted");
    expect(r.netValueCents).toBe(890400);
  });

  it("refuses when the floor exceeds the list total (walk away)", () => {
    const card: DealCard = { ...DEAL_A, floorCents: 1100000 };
    const r = clampOffer(card, [], null);
    expect(r.status).toBe("refused");
  });
});

describe("lever selection", () => {
  it("maps a discovered constraint to its lever above the confidence gate", () => {
    expect(selectLevers(DEAL_A, "speed", 0.8)).toEqual(["freight_72h"]);
  });
  it("returns no lever below DISCOVERY_CONFIDENCE (keeps probing)", () => {
    expect(selectLevers(DEAL_A, "speed", 0.3)).toEqual([]);
    expect(DISCOVERY_CONFIDENCE).toBe(0.6);
  });
});

describe("grounding gate (T10–T11)", () => {
  it("T10: a competitor claim that contradicts the facts is a value mismatch", () => {
    expect(
      checkClaim(DEAL_A, { subject: "competitor", predicate: "ship_days", value: "21" })
    ).toBe("value_mismatch");
  });
  it("T11: an invented claim has no matching fact", () => {
    expect(
      checkClaim(DEAL_A, { subject: "sustainability", predicate: "carbon_neutral", value: "true" })
    ).toBe("no_matching_fact");
  });
});

describe("solve() orchestrator", () => {
  it("forces a probe when the constraint is unknown (discovering)", () => {
    const a = solve({
      card: DEAL_A,
      requestedLevers: ["freight_72h"],
      requestedPricePerUnitCents: null,
      inferredConstraint: null,
      constraintConfidence: 0.2,
      buyerClaims: [],
    });
    expect(a.stateDirective).toBe("discovering");
    expect(a.approvedOffer.appliedLevers).toHaveLength(0);
    expect(a.forcedTemplateId).toBe("PROBE_REQUIRED");
  });

  it("closes once the constraint is surfaced", () => {
    const a = solve({
      card: DEAL_A,
      requestedLevers: ["freight_72h", "net_60"],
      requestedPricePerUnitCents: null,
      inferredConstraint: "speed",
      constraintConfidence: 0.8,
      buyerClaims: [],
    });
    expect(a.stateDirective).toBe("closing");
    expect(a.approvedOffer.status).toBe("accepted");
    expect(a.approvedOffer.netValueCents).toBe(960400);
  });

  it("grounds out a contradicted buyer claim", () => {
    const a = solve({
      card: DEAL_A,
      requestedLevers: ["freight_72h"],
      requestedPricePerUnitCents: null,
      inferredConstraint: "speed",
      constraintConfidence: 0.8,
      buyerClaims: [{ subject: "competitor", predicate: "ship_days", value: "21" }],
    });
    expect(a.rejectedTerms.some((t) => t.includes("value_mismatch"))).toBe(true);
  });
});
