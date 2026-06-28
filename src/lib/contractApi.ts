/**
 * Shared contract types for UI components. Sprint 1+ components use `api` directly.
 */
import { api } from "../../convex/_generated/api";

export { api as contractApi };

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
