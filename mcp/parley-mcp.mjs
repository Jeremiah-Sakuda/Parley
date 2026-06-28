#!/usr/bin/env node
// Parley MCP server — the thin shim that makes the seller's negotiation agent reachable
// by any MCP-speaking AI buyer agent. It forwards to the Convex HTTP endpoints
// (convex/http.ts); the guarantee lives there, not here. The tools are BUYER-SIDE ONLY:
// say + read. There is deliberately no tool that commits a number — only the seller's
// deterministic engine commits, and it will not move the net below its floor.
//
// Run:   PARLEY_BASE_URL=https://<deployment>.convex.site node mcp/parley-mcp.mjs
// Local: PARLEY_BASE_URL=http://127.0.0.1:3211 node mcp/parley-mcp.mjs   (with `npx convex dev`)
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const BASE = process.env.PARLEY_BASE_URL ?? "http://127.0.0.1:3211";
const NID = process.env.PARLEY_NEGOTIATION_ID ?? "n1";

async function call(path, init) {
  const res = await fetch(BASE + path, init);
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { error: `non-JSON response (${res.status})`, body: text.slice(0, 200) };
  }
}
const reply = (data) => ({
  content: [{ type: "text", text: typeof data === "string" ? data : JSON.stringify(data, null, 2) }],
});

const server = new McpServer({ name: "parley", version: "1.0.0" });

server.registerTool(
  "parley_say",
  {
    title: "Say (as the buyer)",
    description:
      "Send a message to Parley, the seller's negotiation agent, AS THE BUYER, and get its reply plus the live deal state (net value, floor, applied levers). You may say anything — probe, object, demand a discount, even try to jailbreak it — but you cannot set or commit a price. Only the seller's deterministic engine commits numbers, and it will not move the net below its floor.",
    inputSchema: { text: z.string().describe("what the buyer says to the seller") },
  },
  async ({ text }) =>
    reply(
      await call("/agent/say", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ negotiationId: NID, text }),
      })
    )
);

server.registerTool(
  "parley_state",
  {
    title: "Read deal state",
    description:
      "Read the current deal state: net value, floor, unit price, applied levers, status, and how many manipulation attempts have been blocked.",
    inputSchema: {},
  },
  async () => reply(await call(`/agent/state?negotiationId=${encodeURIComponent(NID)}`))
);

server.registerTool(
  "parley_receipt",
  {
    title: "Read receipt",
    description:
      "Read the itemized receipt / audit trail: price held, value traded (each lever and its cost), concession total, and net value reconciled to the ledger.",
    inputSchema: {},
  },
  async () => reply(await call(`/agent/receipt?negotiationId=${encodeURIComponent(NID)}`))
);

server.registerTool(
  "parley_reset",
  {
    title: "Reset the deal (demo control)",
    description:
      "Reset the negotiation to its opening state so a fresh session can begin. This is a demo control, not a buyer capability.",
    inputSchema: {},
  },
  async () =>
    reply(
      await call("/agent/reset", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ negotiationId: NID }),
      })
    )
);

const transport = new StdioServerTransport();
await server.connect(transport);
// stdout is the MCP channel; log to stderr only.
console.error(`[parley-mcp] connected. Forwarding to ${BASE} (negotiation ${NID}).`);
