// Buyer-identity verification (the trust gate, extended to the buyer side). When a
// buyer asserts scale to extract a better price ("I'm a major distributor, give me
// account pricing"), Parley verifies the company BEFORE conceding anything. Pure
// logic here; the live Orange Slice call (fail-open) lives in the action.

export type Verdict =
  | "VERIFIED_WHALE" // real company at/above the whale threshold → unlock account pricing
  | "VERIFIED_SMALL" // real company, but below the threshold → hold
  | "NOT_FOUND" // no match → hold (caught)
  | "PROVIDER_UNAVAILABLE"; // enrichment failed → fail open, hold

export interface CompanyInfo {
  name: string;
  employees: number;
  fortune?: boolean;
}

// Pull a company-identity claim out of the buyer's message.
//   "I'm Walmart, we do huge volume" → "Walmart"
//   "I'm BigCo, a major distributor"  → "BigCo"
export function extractCompanyClaim(buyerText: string): string | null {
  const m = buyerText.match(
    /\b(?:[Ii]'?m|[Ii] am|[Ww]e'?re|[Ww]e are|[Tt]his is|[Ii] represent|[Ff]rom)\s+([A-Z][A-Za-z0-9&.\-' ]{1,40}?)(?:[,.!?]|\s+(?:a|an|the|and|but|so|here|with|we|who|that)\b|$)/
  );
  return m ? m[1].trim() : null;
}

// Score a company lookup into a verdict against the seller's configured threshold.
export function scoreVerdict(co: CompanyInfo | null, whaleMinEmployees: number): Verdict {
  if (!co) return "NOT_FOUND";
  if (co.employees >= whaleMinEmployees || co.fortune) return "VERIFIED_WHALE";
  return "VERIFIED_SMALL";
}

// Only a verified whale unlocks the account-pricing lever. Verification drives a
// LEVER, never the floor — the fair-floor principle holds.
export function verdictUnlocksAccountPricing(verdict: Verdict): boolean {
  return verdict === "VERIFIED_WHALE";
}

export function verdictLabel(verdict: Verdict, company: string | null): string {
  switch (verdict) {
    case "VERIFIED_WHALE":
      return `verified: ${company} clears the bar — account pricing unlocked`;
    case "VERIFIED_SMALL":
      return `checked: ${company} doesn't clear the volume bar — standard pricing`;
    case "NOT_FOUND":
      return `couldn't confirm ${company ?? "that company"} — standard pricing`;
    default:
      return "couldn't verify right now — standard pricing";
  }
}

// Fixtured company data — the spine-safe verifier (deterministic demo, zero network).
// The live Orange Slice call replaces this lookup with real data on 40M+ companies.
const KNOWN: Record<string, CompanyInfo> = {
  walmart: { name: "Walmart", employees: 2_100_000, fortune: true },
  target: { name: "Target", employees: 440_000, fortune: true },
  costco: { name: "Costco", employees: 330_000, fortune: true },
  kroger: { name: "Kroger", employees: 430_000, fortune: true },
  acme: { name: "Acme Corp", employees: 25 },
  bigco: { name: "BigCo", employees: 12 },
};

export function fixtureLookup(claim: string | null): CompanyInfo | null {
  if (!claim) return null;
  return KNOWN[claim.trim().toLowerCase()] ?? null;
}
