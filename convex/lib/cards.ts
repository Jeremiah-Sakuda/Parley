import type { QueryCtx, MutationCtx } from "../_generated/server";
import type { DealCard } from "../engine/types";
import { DEAL_A, DEAL_B } from "../engine/fixtures";

// Load the live deal card for a scenario from the DB; fall back to the fixture if
// the table isn't seeded yet (keeps the UI working through the seed transition).
export async function loadCard(
  ctx: QueryCtx | MutationCtx,
  scenarioId: string
): Promise<DealCard> {
  const doc = await ctx.db
    .query("dealCards")
    .withIndex("by_scenario", (q) => q.eq("scenarioId", scenarioId))
    .unique();
  if (doc) {
    const { _id, _creationTime, ...card } = doc;
    return card as DealCard;
  }
  return scenarioId === "deal-b" ? DEAL_B : DEAL_A;
}
