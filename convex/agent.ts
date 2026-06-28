import { action, internalQuery } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { v } from "convex/values";
import { buildSystemPrompt, LLM_PROPOSAL_SCHEMA } from "./agent/contract";
import { decide, fallbackProposal, mergeSignals } from "./agent/decide";
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

// OpenAI with strict structured output. Returns null on any failure → the caller
// falls back to the deterministic keyword proposal (Sprint 8 hardens the timeout).
async function callOpenAI(system: string, user: string): Promise<LLMProposal | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
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

// The seller turn: LLM proposes → engine decides → engine commits the levers (it
// clamps each; the LLM never sets a number) → seller message is written. The offer's
// numbers come only from commitConcession, never from the model's prose.
export const respond = action({
  args: { negotiationId: v.string(), buyerText: v.string() },
  returns: v.null(),
  handler: async (ctx, { negotiationId, buyerText }) => {
    const { scenarioId, history } = await ctx.runQuery(internal.agent.context, { negotiationId });
    const card = (await ctx.runQuery(api.deals.activeCard, { scenarioId })) as unknown as DealCard;

    const system = buildSystemPrompt(card);
    const convo = history.map((h) => `${h.role}: ${h.text}`).join("\n");
    const user = `Conversation so far:\n${convo}\n\nBuyer just said: "${buyerText}"\nReturn your structured proposal.`;

    const llm = (await callOpenAI(system, user)) ?? fallbackProposal(buyerText);
    const proposal = mergeSignals(llm, buyerText);
    const decision = decide(proposal, card);

    // The engine commits the levers — the only path to a number. A leverId is all
    // that crosses; no price from the model can ever be committed.
    for (const leverId of decision.levers) {
      await ctx.runMutation(api.negotiate.commitConcession, { negotiationId, leverId });
    }
    await ctx.runMutation(internal.messages.appendSeller, {
      negotiationId,
      text: decision.sellerText,
      isProbe: decision.isProbe,
      confidence: decision.confidence,
    });
    return null;
  },
});
