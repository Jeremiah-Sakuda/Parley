import { query, action } from "./_generated/server";
import { api } from "./_generated/api";
import { v } from "convex/values";
import { loadCard } from "./lib/cards";
import { SEED_LEADS, qualify } from "./engine/qualify";

// The top-of-funnel bookend. Each lead is scored by the SAME engine run forward, so
// the pipeline only flags deals that clear the seller's one floor. The SKIP is the
// hero — the engine refusing to chase an unprofitable lead, the twin of the close's
// floor-breach refusal.
export const qualifyLeads = query({
  args: { scenarioId: v.string() },
  returns: v.array(
    v.object({
      id: v.string(),
      company: v.string(),
      estUnits: v.number(),
      likelyPriority: v.string(),
      decision: v.string(),
      reason: v.string(),
      netAtFloorCents: v.number(),
      headroomCents: v.number(),
    })
  ),
  handler: async (ctx, { scenarioId }) => {
    const card = await loadCard(ctx, scenarioId);
    return SEED_LEADS.map((lead) => {
      const verdict = qualify(lead, card);
      return {
        id: lead.id,
        company: lead.company,
        estUnits: lead.estUnits,
        likelyPriority: lead.likelyPriority,
        decision: verdict.decision,
        reason: verdict.reason,
        netAtFloorCents: verdict.netAtFloorCents,
        headroomCents: verdict.headroomCents,
      };
    });
  },
});

// Open a PURSUE'd lead in the negotiation console: reset the console clean and carry
// the lead's claimedScale into the close (for the verify-gate bluff-check). The
// seamless top → bottom flow.
export const loadLead = action({
  args: { leadId: v.string(), negotiationId: v.string() },
  returns: v.union(v.object({ company: v.string(), claimedScale: v.string() }), v.null()),
  handler: async (
    ctx,
    { leadId, negotiationId }
  ): Promise<{ company: string; claimedScale: string } | null> => {
    const lead = SEED_LEADS.find((l) => l.id === leadId);
    if (!lead) return null;
    await ctx.runMutation(api.seed.reset, { negotiationId, scenarioId: "deal-a" });
    return { company: lead.company, claimedScale: lead.claimedScale ?? lead.company };
  },
});
