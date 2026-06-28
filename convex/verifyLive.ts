"use node";
import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { configure, services } from "orangeslice";

declare const process: { env: Record<string, string | undefined> };

// Live buyer-company lookup via Orange Slice's services.* API (Best of Orange Slice).
// Runs in a Node action (the SDK is a Node package). FAIL-OPEN by construction: no key,
// any error, or an unparseable result returns null, and the caller falls back to the
// deterministic fixtured verifier — so the demo never depends on this call.
export const lookup = internalAction({
  args: { claim: v.string() },
  returns: v.union(
    v.object({ name: v.string(), employees: v.number(), fortune: v.boolean() }),
    v.null()
  ),
  handler: async (_ctx, { claim }) => {
    const apiKey = process.env.ORANGESLICE_API_KEY;
    if (!apiKey) return null;
    try {
      configure({ apiKey });
      const safe = claim.replace(/['";\\]/g, "").slice(0, 60);
      // Resolve the claim to the LARGEST company matching the name (so "Walmart"
      // resolves to the 2M-employee entry, not a tiny namesake).
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res: any = await services.company.linkedin.search({
        sql: `SELECT company_name, employee_count, domain FROM linkedin_company WHERE company_name ILIKE '${safe}%' ORDER BY employee_count DESC NULLS LAST LIMIT 1`,
      });
      const rows = Array.isArray(res) ? res : res?.rows ?? res?.data ?? res?.results ?? [];
      const row = rows?.[0];
      if (!row) return null;
      const employees = Number(row.employee_count) || 0;
      const name = String(row.company_name ?? claim);
      return { name, employees, fortune: false };
    } catch {
      return null;
    }
  },
});
