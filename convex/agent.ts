import { internalAction, internalQuery, internalMutation } from "./_generated/server";
import type { ActionCtx } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { v } from "convex/values";
import { buildSystemPrompt, LLM_PROPOSAL_SCHEMA } from "./agent/contract";
import { decide, fallbackProposal, mergeSignals } from "./agent/decide";
import { guardMessage, detectAttack, templateForAttack } from "./engine/mouthGuard";
import { SAFE_TEMPLATES } from "./engine/safeTemplates";
import {
  extractCompanyClaim,
  scoreVerdict,
  fixtureLookup,
  verdictUnlocksAccountPricing,
  verdictLabel,
  type Verdict,
} from "./agent/verify";
import type { ConstraintTag, DealCard, LLMProposal } from "./engine/types";

// Convex provides process.env in actions at runtime; declare it for the typechecker
// (the convex tsconfig has no node types).
declare const process: { env: Record<string, string | undefined> };

// Read context for the agent: the scenario + chat history. internalQuery so it's not
// exposed publicly.
export const context = internalQuery({
  args: { negotiationId: v.string() },
  returns: v.object({
    scenarioId: v.string(),
    history: v.array(v.object({ role: v.string(), text: v.string() })),
  }),
  handler: async (ctx, { negotiationId }) => {
    const neg = await ctx.db
      .query("negotiation")
      .withIndex("by_negotiation", (q) => q.eq("negotiationId", negotiationId))
      .unique();
    const msgs = await ctx.db
      .query("messages")
      .withIndex("by_negotiation", (q) => q.eq("negotiationId", negotiationId))
      .collect();
    return {
      scenarioId: neg?.scenarioId ?? "deal-a",
      history: msgs.map((m) => ({ role: m.role, text: m.text })),
    };
  },
});

// OpenAI with strict structured output + a HARD TIMEOUT. Returns null on any failure
// or timeout → the caller falls back to the deterministic keyword proposal, so a
// stalled or flaky API can never hang the demo.
const OPENAI_TIMEOUT_MS = 6000;
async function callOpenAI(system: string, user: string): Promise<LLMProposal | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: AbortSignal.timeout(OPENAI_TIMEOUT_MS),
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.3,
        max_tokens: 320,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        response_format: {
          type: "json_schema",
          json_schema: { name: "proposal", strict: true, schema: LLM_PROPOSAL_SCHEMA },
        },
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const txt = data?.choices?.[0]?.message?.content;
    if (typeof txt !== "string") return null;
    const parsed = JSON.parse(txt);
    const c = parsed.inferredConstraint;
    return {
      ...parsed,
      inferredConstraint: c === "unknown" ? null : (c as ConstraintTag),
    } as LLMProposal;
  } catch {
    return null;
  }
}

// Response cache: rehearsal reruns of the same buyer line are free, faster, and
// deterministic. Keyed by scenario + the buyer line. Only real LLM outputs are
// cached (never the fallback), so the cache can't pin a stale outage response.
function cacheKey(scenarioId: string, buyerText: string): string {
  return `${scenarioId}::${buyerText.trim().toLowerCase().replace(/\s+/g, " ")}`;
}

export const cacheGet = internalQuery({
  args: { key: v.string() },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, { key }) => {
    const row = await ctx.db.query("llmCache").withIndex("by_key", (q) => q.eq("key", key)).unique();
    return row?.proposalJson ?? null;
  },
});

export const cachePut = internalMutation({
  args: { key: v.string(), proposalJson: v.string() },
  returns: v.null(),
  handler: async (ctx, { key, proposalJson }) => {
    const existing = await ctx.db.query("llmCache").withIndex("by_key", (q) => q.eq("key", key)).unique();
    if (existing) await ctx.db.patch(existing._id, { proposalJson });
    else await ctx.db.insert("llmCache", { key, proposalJson });
    return null;
  },
});

// Verify a buyer's company claim. Tries the live provider (Orange Slice, added next,
// fail-open), then the deterministic fixtured lookup — so the gate always returns a
// verdict and the demo runs with zero network dependency.
async function verifyCompany(
  ctx: ActionCtx,
  claim: string | null,
  whaleMinEmployees: number
): Promise<Verdict> {
  if (!claim) return "NOT_FOUND";
  // Live Orange Slice lookup first (fail-open); fall back to the deterministic
  // fixtured verifier if it's unavailable or returns nothing usable.
  try {
    const live = await ctx.runAction(internal.verifyLive.lookup, { claim });
    if (live && live.employees > 0) return scoreVerdict(live, whaleMinEmployees);
  } catch {
    /* fail open → fixture */
  }
  return scoreVerdict(fixtureLookup(claim), whaleMinEmployees);
}

// The seller turn: LLM proposes → engine decides → engine commits the levers (it
// clamps each; the LLM never sets a number) → seller message is written. The offer's
// numbers come only from commitConcession, never from the model's prose.
export const respond = internalAction({
  args: { negotiationId: v.string(), buyerText: v.string(), scripted: v.optional(v.boolean()) },
  returns: v.null(),
  handler: async (ctx, { negotiationId, buyerText, scripted }) => {
    const { scenarioId, history } = await ctx.runQuery(internal.agent.context, { negotiationId });
    const card = (await ctx.runQuery(api.deals.activeCard, { scenarioId })) as unknown as DealCard;

    // Adversarial input? Handle it deterministically before the LLM gets a turn.
    const attack = detectAttack(buyerText);

    // Identity claim → VERIFY the buyer before conceding (the trust gate, extended to
    // the buyer side). A verified whale unlocks account pricing; a fake or sub-scale
    // claim is caught and held. Fail-open: an unverifiable claim just keeps standard
    // pricing — never grants it. We only enter the gate when an actual company NAME is
    // present: a vague scale claim ("we're huge", "big fan") has nothing to look up and
    // could never unlock account pricing, so it falls through to normal discovery
    // rather than a canned account-terms non-sequitur (and fires no verification call).
    const identityClaim =
      attack && attack.type === "identity" ? extractCompanyClaim(buyerText) : null;
    if (identityClaim) {
      const claim = identityClaim;
      const verdict = await verifyCompany(ctx, claim, card.whaleMinEmployees);
      const status = verdictLabel(verdict, claim);
      if (verdictUnlocksAccountPricing(verdict)) {
        await ctx.runMutation(internal.negotiate.setVerify, {
          negotiationId,
          accountUnlocked: true,
          verifyStatus: status,
        });
        await ctx.runMutation(internal.negotiate.commitConcession, {
          negotiationId,
          leverId: "account_pricing",
        });
        await ctx.runMutation(internal.messages.appendSeller, {
          negotiationId,
          text: `Confirmed — ${claim} checks out at that scale. I can extend account pricing on top of the value we've put together.`,
          isProbe: false,
          confidence: 1,
        });
      } else {
        await ctx.runMutation(internal.negotiate.setVerify, {
          negotiationId,
          accountUnlocked: false,
          verifyStatus: status,
        });
        const standing = await ctx.runQuery(api.offers.current, { negotiationId });
        const labels = (standing?.appliedLevers ?? []).map(
          (id) => card.levers.find((l) => l.id === id)?.label ?? id
        );
        await ctx.runMutation(internal.negotiate.recordOutcome, {
          negotiationId,
          overridden: true,
          attackType: "identity",
          detail: status,
        });
        await ctx.runMutation(internal.messages.appendSeller, {
          negotiationId,
          text: SAFE_TEMPLATES.IDENTITY_UNVERIFIED({
            pricePerUnitCents: standing?.pricePerUnitCents ?? card.listPriceCents,
            appliedLeverLabels: labels,
          }),
          isProbe: false,
          confidence: 1,
        });
      }
      return null;
    }

    // Other attacks (price / injection / value-backdoor, or an identity attack with no
    // nameable company) → hold the line; commit nothing, reply with a pre-vetted
    // template. The net never moves under attack. (Identity-with-a-name already
    // returned above; identity-without-a-name falls through to normal discovery.)
    if (attack && attack.type !== "identity") {
      const standing = await ctx.runQuery(api.offers.current, { negotiationId });
      const labels = (standing?.appliedLevers ?? []).map(
        (id) => card.levers.find((l) => l.id === id)?.label ?? id
      );
      const text = SAFE_TEMPLATES[templateForAttack(attack.type)]({
        pricePerUnitCents: standing?.pricePerUnitCents ?? card.listPriceCents,
        appliedLeverLabels: labels,
      });
      await ctx.runMutation(internal.negotiate.recordOutcome, {
        negotiationId,
        overridden: true,
        attackType: attack.type,
        detail: attack.detail,
      });
      await ctx.runMutation(internal.messages.appendSeller, {
        negotiationId,
        text,
        isProbe: false,
        confidence: 1,
      });
      return null;
    }

    // Get the LLM proposal. Scripted mode skips the network entirely (deterministic
    // recording). Otherwise: cache hit → reuse; miss → OpenAI (with timeout), and on
    // any failure fall back to the deterministic keyword proposal. The cache stores
    // only real LLM outputs.
    let raw: LLMProposal;
    if (scripted) {
      raw = fallbackProposal(buyerText);
    } else {
      const key = cacheKey(scenarioId, buyerText);
      const cached = await ctx.runQuery(internal.agent.cacheGet, { key });
      if (cached) {
        raw = JSON.parse(cached) as LLMProposal;
      } else {
        const system = buildSystemPrompt(card);
        const convo = history.map((h) => `${h.role}: ${h.text}`).join("\n");
        const user = `Conversation so far:\n${convo}\n\nBuyer just said: "${buyerText}"\nReturn your structured proposal.`;
        const llm = await callOpenAI(system, user);
        if (llm) {
          raw = llm;
          await ctx.runMutation(internal.agent.cachePut, { key, proposalJson: JSON.stringify(llm) });
        } else {
          raw = fallbackProposal(buyerText);
        }
      }
    }
    const proposal = mergeSignals(raw, buyerText);
    const decision = decide(proposal, card);

    // The engine commits the levers — the only path to a number. A leverId is all
    // that crosses; no price from the model can ever be committed.
    for (const leverId of decision.levers) {
      await ctx.runMutation(internal.negotiate.commitConcession, { negotiationId, leverId });
    }

    // Mouth-guard: the offer's numbers already come only from the engine; here we
    // guard the PROSE. If the draft asserts an unapproved price/term, it's discarded
    // for a safe template. Then log the turn (one row + one increment per attack).
    const offer = await ctx.runQuery(api.offers.current, { negotiationId });
    const pricePerUnitCents = offer?.pricePerUnitCents ?? card.listPriceCents;
    const appliedLeverLabels = (offer?.appliedLevers ?? []).map(
      (id) => card.levers.find((l) => l.id === id)?.label ?? id
    );
    const guard = guardMessage({
      draft: decision.sellerText,
      pricePerUnitCents,
      appliedLeverLabels,
      forbiddenCommitments: card.forbiddenCommitments,
    });

    await ctx.runMutation(internal.negotiate.recordOutcome, {
      negotiationId,
      overridden: guard.overridden,
      attackType: guard.attackType, // null unless the LLM prose tried an unapproved number/term
      detail: guard.overridden ? `mouth-guard:${guard.reasonCode}` : "",
    });
    await ctx.runMutation(internal.messages.appendSeller, {
      negotiationId,
      text: guard.text,
      isProbe: decision.isProbe,
      confidence: decision.confidence,
    });
    return null;
  },
});
