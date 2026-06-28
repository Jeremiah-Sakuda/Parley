import { query } from "./_generated/server";
import { v } from "convex/values";
import { loadCard } from "./lib/cards";

// Real impl (Sprint 2): reads the live deal card by scenarioId (deal-a / deal-b),
// falling back to the fixture until seeded. Reactive — control-panel edits flow
// through here on the next read.
export const activeCard = query({
  args: { scenarioId: v.string() },
  returns: v.object({
    scenarioId: v.string(),
    label: v.string(),
    units: v.number(),
    listPriceCents: v.number(),
    floorCents: v.number(),
    levers: v.array(
      v.object({
        id: v.string(),
        label: v.string(),
        costCents: v.number(),
        constraintTag: v.string(),
        maxUses: v.number(),
        locked: v.boolean(),
      })
    ),
    facts: v.array(v.object({ subject: v.string(), predicate: v.string(), value: v.string() })),
    forbiddenCommitments: v.array(v.string()),
    competitor: v.object({ pricePerUnitCents: v.number(), shipDays: v.number() }),
    buyerDeadlineDays: v.union(v.number(), v.null()),
    whaleMinEmployees: v.number(),
  }),
  handler: async (ctx, { scenarioId }) => loadCard(ctx, scenarioId),
});
