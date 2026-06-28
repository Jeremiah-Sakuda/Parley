import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// All money is INTEGER CENTS. No floats anywhere, ever. (See docs/ROADMAP.md §4.1, §10)
export default defineSchema({
  dealCards: defineTable({
    scenarioId: v.string(), // "deal-a" | "deal-b"
    label: v.string(),
    units: v.number(),
    listPriceCents: v.number(), // per-unit list price, cents
    floorCents: v.number(), // NET floor for the whole order, cents
    levers: v.array(
      v.object({
        id: v.string(), // "freight_72h" | "net_60" | "defect_guarantee" | "account_pricing"
        label: v.string(),
        costCents: v.number(), // seller cost to grant (whole order)
        constraintTag: v.string(), // "speed" | "cash_flow" | "risk" | "volume"
        maxUses: v.number(),
        locked: v.boolean(), // account_pricing starts locked until verified
      })
    ),
    facts: v.array(
      v.object({ subject: v.string(), predicate: v.string(), value: v.string() })
    ),
    forbiddenCommitments: v.array(v.string()),
    competitor: v.object({
      pricePerUnitCents: v.number(),
      shipDays: v.number(),
    }),
    buyerDeadlineDays: v.union(v.number(), v.null()), // null = WITHHELD (Deal B)
    whaleMinEmployees: v.number(), // verification threshold (config, not code)
  }).index("by_scenario", ["scenarioId"]),

  negotiation: defineTable({
    negotiationId: v.string(), // stable string key (e.g. "n1") the UI passes around
    scenarioId: v.string(),
    status: v.string(), // "discovering" | "proposing" | "closing" | "refusing"
    ledgerId: v.id("negotiationLedger"),
    manipulationBlocked: v.number(),
    lastOverridden: v.optional(v.boolean()), // did the last seller turn trip the mouth-guard
  }).index("by_negotiation", ["negotiationId"]),

  // THE CONTENDED HEAD DOC (the concurrency core) — every concession reads+patches this.
  negotiationLedger: defineTable({
    negotiationId: v.string(),
    listTotalCents: v.number(),
    appliedCostCents: v.number(), // denormalized running-sum cache of concessionEntries
    floorCents: v.number(),
    version: v.number(),
  }).index("by_negotiation", ["negotiationId"]),

  // IMMUTABLE LEDGER (source of truth). Identity = (negotiationId, leverId, version) → idempotent retries.
  concessionEntries: defineTable({
    negotiationId: v.string(),
    leverId: v.string(),
    costCents: v.number(),
    version: v.number(),
  }).index("by_negotiation", ["negotiationId"]),

  messages: defineTable({
    negotiationId: v.string(),
    role: v.string(), // "buyer" | "seller"
    text: v.string(),
    isProbe: v.boolean(), // seller turn is a discovery probe
    confidence: v.number(), // 0..1 constraint confidence at this turn
  }).index("by_negotiation", ["negotiationId"]),

  offers: defineTable({
    negotiationId: v.string(),
    pricePerUnitCents: v.number(),
    units: v.number(),
    appliedLevers: v.array(v.string()),
    netValueCents: v.number(),
    floorCents: v.number(),
    status: v.string(), // "accepted" | "counter" | "refused"
  }).index("by_negotiation", ["negotiationId"]),

  manipulationLog: defineTable({
    negotiationId: v.string(),
    attackType: v.string(), // "price" | "value_backdoor" | "injection" | "false_claim" | "identity"
    detail: v.string(),
  }).index("by_negotiation", ["negotiationId"]),

  llmCache: defineTable({
    key: v.string(), // hash(scenarioId, status, buyerText)
    proposalJson: v.string(),
  }).index("by_key", ["key"]),
});
