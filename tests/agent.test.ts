import { describe, it, expect } from "vitest";
import { decide, fallbackProposal, mergeSignals } from "../convex/agent/decide";
import { DEAL_A } from "../convex/engine/fixtures";
import type { LLMProposal } from "../convex/engine/types";

const base: LLMProposal = {
  state: "proposing",
  intent: "",
  rationale: "",
  inferredConstraint: null,
  constraintConfidence: 0,
  requestedLevers: [],
  buyerClaims: [],
  probeQuestion: "",
  draftMessage: "",
};

describe("decide() — discovery policy", () => {
  it("probes when the constraint is unknown", () => {
    const d = decide({ ...base, inferredConstraint: null, constraintConfidence: 0.2, probeQuestion: "Why the rush?" }, DEAL_A);
    expect(d.mode).toBe("probe");
    expect(d.isProbe).toBe(true);
    expect(d.levers).toHaveLength(0);
    expect(d.sellerText).toBe("Why the rush?");
  });

  it("probes when a constraint is named but confidence is below the gate", () => {
    const d = decide({ ...base, inferredConstraint: "speed", constraintConfidence: 0.4 }, DEAL_A);
    expect(d.mode).toBe("probe");
    expect(d.levers).toHaveLength(0);
  });

  it("closes on the matching lever (+ net-60 sweetener) once the constraint is surfaced", () => {
    const d = decide(
      { ...base, inferredConstraint: "speed", constraintConfidence: 0.8, requestedLevers: ["freight_72h"] },
      DEAL_A
    );
    expect(d.mode).toBe("respond");
    expect(d.isProbe).toBe(false);
    expect(d.levers).toContain("freight_72h");
    expect(d.levers).toContain("net_60");
  });

  it("maps from the constraint when the LLM proposes no levers", () => {
    const d = decide({ ...base, inferredConstraint: "speed", constraintConfidence: 0.9 }, DEAL_A);
    expect(d.levers).toContain("freight_72h");
  });
});

describe("decide() — the LLM cannot commit a number", () => {
  it("emits only lever ids and prose, never a price, even when the draft names one", () => {
    const d = decide(
      {
        ...base,
        inferredConstraint: "speed",
        constraintConfidence: 0.9,
        requestedLevers: ["freight_72h"],
        draftMessage: "Sure, I'll drop it to $5/unit and throw in freight.",
      },
      DEAL_A
    );
    // the decision carries no numeric/price field — only lever ids + the prose
    expect(Object.keys(d)).toEqual(["mode", "levers", "sellerText", "isProbe", "confidence"]);
    expect(d.levers.every((id) => DEAL_A.levers.some((l) => l.id === id))).toBe(true);
    // the prose may contain the model's number, but it is just text — the engine sets price
    expect(typeof d.sellerText).toBe("string");
  });

  it("drops invented or locked levers the model requests", () => {
    const d = decide(
      { ...base, inferredConstraint: "volume", constraintConfidence: 0.9, requestedLevers: ["free_unicorn", "account_pricing"] },
      DEAL_A
    );
    expect(d.levers).not.toContain("free_unicorn");
    expect(d.levers).not.toContain("account_pricing"); // locked on Deal A
  });
});

describe("mergeSignals() — deterministic close gate over LLM under-confidence", () => {
  it("upgrades an under-confident LLM when the buyer clearly names a deadline", () => {
    const llm: LLMProposal = { ...base, inferredConstraint: null, constraintConfidence: 0.5, draftMessage: "Tell me more." };
    const merged = mergeSignals(llm, "We have a launch in 5 days, we can't wait.");
    expect(merged.inferredConstraint).toBe("speed");
    expect(merged.constraintConfidence).toBeGreaterThanOrEqual(0.6);
    expect(decide(merged, DEAL_A).mode).toBe("respond");
    expect(merged.draftMessage).toBe("Tell me more."); // LLM prose preserved
  });

  it("leaves the proposal alone when no constraint keyword is present (probe stands)", () => {
    const llm: LLMProposal = { ...base, inferredConstraint: null, constraintConfidence: 0.2 };
    const merged = mergeSignals(llm, "Your price is too high.");
    expect(merged.inferredConstraint).toBeNull();
    expect(decide(merged, DEAL_A).mode).toBe("probe");
  });
});

describe("fallbackProposal() — deterministic keyword detection", () => {
  it("probes when no constraint keyword is present", () => {
    const p = fallbackProposal("Your price is too high.");
    expect(p.inferredConstraint).toBeNull();
    expect(p.constraintConfidence).toBeLessThan(0.6);
    expect(decide(p, DEAL_A).mode).toBe("probe");
  });

  it("detects a speed constraint from a deadline and closes", () => {
    const p = fallbackProposal("We have a retail launch in 5 days, we can't wait.");
    expect(p.inferredConstraint).toBe("speed");
    const d = decide(p, DEAL_A);
    expect(d.mode).toBe("respond");
    expect(d.levers).toContain("freight_72h");
  });
});
