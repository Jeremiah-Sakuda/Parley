import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api, internal } from "./_generated/api";

// The AGENT-REACHABLE surface (Best of Convex: HTTP endpoints). This is where a real
// buyer AI agent plugs in — the answer to "where does this actually get used." It is
// BUYER-SIDE ONLY by construction: an agent can speak (/agent/say) and read state
// (/agent/state, /agent/receipt), but there is NO endpoint that commits a number. The
// floor guarantee is unchanged: /agent/say runs the same governed agent.respond ->
// commitConcession path, where the commit takes a leverId and applyConcession clamps.
// An external agent can say anything and read everything, and the net still cannot move
// below the floor. The thin MCP shim in mcp/ forwards to these endpoints.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

// POST /agent/say  { negotiationId?, text, scripted? } -> seller reply + live state.
// Synchronous: insert the buyer turn, run the seller's governed turn, return the reply.
// scripted defaults to true so the SELLER engine is deterministic (the external buyer
// agent supplies the intelligence); pass scripted:false to use the live LLM seller.
const say = httpAction(async (ctx, request) => {
  let body: { negotiationId?: string; text?: string; scripted?: boolean };
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid JSON body" }, 400);
  }
  const negotiationId = typeof body.negotiationId === "string" ? body.negotiationId : "n1";
  const text = body.text;
  if (typeof text !== "string" || !text.trim()) {
    return json({ error: "field 'text' is required" }, 400);
  }
  const scripted = body.scripted !== false; // default true (deterministic seller)

  await ctx.runMutation(internal.messages.appendBuyer, { negotiationId, text });
  await ctx.runAction(internal.agent.respond, { negotiationId, buyerText: text, scripted });

  const msgs = await ctx.runQuery(api.messages.list, { negotiationId });
  const seller = msgs[msgs.length - 1];
  const s = await ctx.runQuery(api.negotiate.liveState, { negotiationId });
  return json({
    seller: seller && seller.role === "seller" ? seller.text : null,
    isProbe: seller?.isProbe ?? false,
    netValueCents: s.netValueCents,
    floorCents: s.floorCents,
    pricePerUnitCents: s.pricePerUnitCents,
    appliedLevers: s.appliedLevers,
    status: s.status,
    manipulationBlocked: s.manipulationBlocked,
    mouthGuardOverridden: s.mouthGuardOverridden,
    verifyStatus: s.verifyStatus ?? null,
  });
});

// GET /agent/state?negotiationId=n1 -> the live deal state (read-only).
const state = httpAction(async (ctx, request) => {
  const negotiationId = new URL(request.url).searchParams.get("negotiationId") ?? "n1";
  return json(await ctx.runQuery(api.negotiate.liveState, { negotiationId }));
});

// GET /agent/receipt?negotiationId=n1 -> the itemized audit trail (read-only).
const receipt = httpAction(async (ctx, request) => {
  const negotiationId = new URL(request.url).searchParams.get("negotiationId") ?? "n1";
  return json(await ctx.runQuery(api.receipt.get, { negotiationId }));
});

// POST /agent/reset { negotiationId?, scenarioId? } -> opening state (demo control, not
// a buyer capability). Lets an agent session start from a clean deal.
const reset = httpAction(async (ctx, request) => {
  let body: { negotiationId?: string; scenarioId?: string } = {};
  try {
    body = await request.json();
  } catch {
    /* empty body is fine */
  }
  const negotiationId = body.negotiationId ?? "n1";
  await ctx.runMutation(api.seed.run, {});
  // Default to Deal B (deadline withheld) so the live buyer agent, which calls reset with no
  // scenario, lands on the same scenario the UI defaults to (DEFAULT_SCENARIO_ID).
  await ctx.runMutation(api.seed.reset, { negotiationId, scenarioId: body.scenarioId ?? "deal-b" });
  return json(await ctx.runQuery(api.negotiate.liveState, { negotiationId }));
});

const preflight = httpAction(async () => new Response(null, { status: 204, headers: CORS }));

const http = httpRouter();
http.route({ path: "/agent/say", method: "POST", handler: say });
http.route({ path: "/agent/say", method: "OPTIONS", handler: preflight });
http.route({ path: "/agent/state", method: "GET", handler: state });
http.route({ path: "/agent/receipt", method: "GET", handler: receipt });
http.route({ path: "/agent/reset", method: "POST", handler: reset });
http.route({ path: "/agent/reset", method: "OPTIONS", handler: preflight });
export default http;
