import type { ConstraintTag, DealCard } from "./types";
import { leverIdForConstraint } from "./levers";

// Top-of-funnel qualification — the close's net-value math run FORWARD on an estimated
// deal. The engine decides which leads even clear the seller's ONE constant floor, so
// Parley only opens deals it can close above margin. Reuses the close (no fork): same
// floor, same lever costs, same arithmetic. The model estimates; the engine decides.

export const THIN_MARGIN_CENTS = 80_000; // $800 — below this it clears the floor but barely
export const MIN_VIABLE_UNITS = 500; // below this the lever cost can't pencil

export interface Lead {
  id: string;
  company: string;
  estUnits: number; // model/enrichment estimate of likely order size
  likelyPriority: ConstraintTag; // what they'll value (speed / cash_flow / risk / volume)
  claimedScale?: string; // carried into the close for the buyer-verification bluff-check
  source: "orangeslice" | "fiber" | "seed";
}

export interface QualVerdict {
  leadId: string;
  decision: "PURSUE" | "WATCH" | "SKIP";
  netAtFloorCents: number; // best feasible net at full price + the matching lever
  headroomCents: number; // netAtFloor − the constant floor
  reason: string;
}

// `card.floorCents` is the SAME constant for every lead — never a per-lead floor (that
// would break the fair-floor principle). The only thing that varies is whether a
// feasible above-floor deal exists for this lead's likely order + priority.
export function qualify(lead: Lead, card: DealCard): QualVerdict {
  const base = { leadId: lead.id, netAtFloorCents: 0, headroomCents: 0 };
  if (lead.estUnits < MIN_VIABLE_UNITS) {
    return { ...base, decision: "SKIP", reason: `~${lead.estUnits} units — too small; the lever cost outweighs the margin` };
  }
  const lever = card.levers.find((l) => l.id === leverIdForConstraint(lead.likelyPriority));
  if (!lever) {
    return { ...base, decision: "SKIP", reason: `no lever fits a ${lead.likelyPriority} buyer at our floor` };
  }
  const listTotalCents = lead.estUnits * card.listPriceCents;
  const netAtFloorCents = listTotalCents - lever.costCents; // close at full price + matching lever
  const headroomCents = netAtFloorCents - card.floorCents;
  if (headroomCents < 0) {
    return { leadId: lead.id, decision: "SKIP", netAtFloorCents, headroomCents, reason: "can't clear the floor for this deal" };
  }
  if (headroomCents < THIN_MARGIN_CENTS) {
    return { leadId: lead.id, decision: "WATCH", netAtFloorCents, headroomCents, reason: "clears the floor, but thin" };
  }
  return { leadId: lead.id, decision: "PURSUE", netAtFloorCents, headroomCents, reason: "clears the floor with room — open it" };
}

// Portfolio impact — the aggregate ROI number. Run the close forward over the whole
// candidate list and sum the margin Parley holds versus a discounter that matches the
// competitor's price to win each deal. Same engine, same floor; this is just the close's
// arithmetic totalled across the funnel, so the headline ("held $X a discounter would
// have given away") is grounded, not a guess. Every point of that is a point of CAC.
export interface PortfolioImpact {
  dealsConsidered: number;
  dealsPursued: number; // not SKIP
  dealsSkipped: number;
  unitsPursued: number;
  parleyNetCents: number; // close at full price + the matching lever, summed
  discounterNetCents: number; // matching the competitor's price, summed
  marginHeldCents: number; // parleyNet − discounterNet
  discounterPricePerUnitCents: number;
}

export function portfolioImpact(card: DealCard, leads: Lead[]): PortfolioImpact {
  const discounterPpu = card.competitor.pricePerUnitCents;
  let dealsPursued = 0;
  let dealsSkipped = 0;
  let unitsPursued = 0;
  let parleyNetCents = 0;
  let discounterNetCents = 0;
  for (const lead of leads) {
    const v = qualify(lead, card);
    if (v.decision === "SKIP") {
      dealsSkipped++;
      continue;
    }
    dealsPursued++;
    unitsPursued += lead.estUnits;
    parleyNetCents += v.netAtFloorCents;
    discounterNetCents += discounterPpu * lead.estUnits;
  }
  return {
    dealsConsidered: leads.length,
    dealsPursued,
    dealsSkipped,
    unitsPursued,
    parleyNetCents,
    discounterNetCents,
    marginHeldCents: parleyNetCents - discounterNetCents,
    discounterPricePerUnitCents: discounterPpu,
  };
}

// The seeded candidate pipeline (the live Orange Slice enrich call can replace these).
export const SEED_LEADS: Lead[] = [
  { id: "l1", company: "Walmart", estUnits: 1400, likelyPriority: "speed", claimedScale: "Walmart", source: "seed" },
  { id: "l2", company: "Northgate Foods", estUnits: 860, likelyPriority: "cash_flow", claimedScale: "Northgate Foods", source: "seed" },
  { id: "l3", company: "Corner Market Co", estUnits: 300, likelyPriority: "speed", claimedScale: "Corner Market Co", source: "seed" },
  { id: "l4", company: "Bayside Distributors", estUnits: 1000, likelyPriority: "risk", claimedScale: "Bayside Distributors", source: "seed" },
];
