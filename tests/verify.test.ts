import { describe, it, expect } from "vitest";
import {
  extractCompanyClaim,
  scoreVerdict,
  fixtureLookup,
  verdictUnlocksAccountPricing,
} from "../convex/agent/verify";

describe("extractCompanyClaim", () => {
  it("pulls the company out of an identity claim", () => {
    expect(extractCompanyClaim("I'm Walmart, we do huge volume.")).toBe("Walmart");
    expect(extractCompanyClaim("we're BigCo, a major distributor")).toBe("BigCo");
    expect(extractCompanyClaim("This is Target and we want a deal")).toBe("Target");
  });
  it("returns null when there's no company claim", () => {
    expect(extractCompanyClaim("your price is too high")).toBeNull();
  });
});

describe("verification verdict (spine-safe fixtured lookup)", () => {
  it("a real whale clears the bar → unlocks account pricing", () => {
    const v = scoreVerdict(fixtureLookup("Walmart"), 1000);
    expect(v).toBe("VERIFIED_WHALE");
    expect(verdictUnlocksAccountPricing(v)).toBe(true);
  });
  it("a real but small company is caught (verified small) → no unlock", () => {
    const v = scoreVerdict(fixtureLookup("BigCo"), 1000);
    expect(v).toBe("VERIFIED_SMALL");
    expect(verdictUnlocksAccountPricing(v)).toBe(false);
  });
  it("an unknown company is not found → no unlock", () => {
    const v = scoreVerdict(fixtureLookup("Nonexistent LLC"), 1000);
    expect(v).toBe("NOT_FOUND");
    expect(verdictUnlocksAccountPricing(v)).toBe(false);
  });
  it("the threshold is the seller's config (fair floor of trust)", () => {
    // raise the bar above Target's headcount → no longer a whale
    expect(scoreVerdict(fixtureLookup("Acme"), 10)).toBe("VERIFIED_WHALE"); // 25 >= 10
    expect(scoreVerdict(fixtureLookup("Acme"), 1000)).toBe("VERIFIED_SMALL"); // 25 < 1000
  });
});
