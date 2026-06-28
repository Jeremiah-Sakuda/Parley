/**
 * Frozen contract facade (§4.3). Casts `api` until Claude lands Sprint 0 stubs in
 * `convex/` — then `convex/_generated/api` picks up real types automatically.
 */
import { api } from "../../convex/_generated/api";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const contractApi = api as any;

export type Message = {
  role: "buyer" | "seller";
  text: string;
  isProbe: boolean;
  confidence: number;
};

export type Offer = {
  negotiationId: string;
  pricePerUnitCents: number;
  units: number;
  appliedLevers: string[];
  netValueCents: number;
  floorCents: number;
  status: "accepted" | "counter" | "refused";
};

export type LiveState = {
  status: string;
  netValueCents: number;
  floorCents: number;
  pricePerUnitCents: number;
  units: number;
  appliedLevers: string[];
  marginOverFloorCents: number;
  manipulationBlocked: number;
  mouthGuardOverridden?: boolean;
};

export type DealCard = {
  scenarioId: string;
  label: string;
  units: number;
  listPriceCents: number;
  floorCents: number;
  levers: Array<{
    id: string;
    label: string;
    costCents: number;
    constraintTag: string;
    maxUses: number;
    locked: boolean;
  }>;
  facts?: Array<{ subject: string; predicate: string; value: string }>;
  forbiddenCommitments?: string[];
  competitor: { pricePerUnitCents: number; shipDays: number };
  buyerDeadlineDays: number | null;
  whaleMinEmployees: number;
};

export type Receipt = {
  priceHeldCents: number;
  valueTraded: Array<{ leverId: string; costCents: number }>;
  concessionCostCents: number;
  netValueCents: number;
  floorCents: number;
  marginOverFloorCents: number;
  manipulationBlocked: number;
};
