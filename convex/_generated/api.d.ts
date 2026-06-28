/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as agent from "../agent.js";
import type * as agent_contract from "../agent/contract.js";
import type * as agent_decide from "../agent/decide.js";
import type * as agent_verify from "../agent/verify.js";
import type * as dealCard from "../dealCard.js";
import type * as deals from "../deals.js";
import type * as engine_clamp from "../engine/clamp.js";
import type * as engine_fixtures from "../engine/fixtures.js";
import type * as engine_grounding from "../engine/grounding.js";
import type * as engine_index from "../engine/index.js";
import type * as engine_ledger from "../engine/ledger.js";
import type * as engine_levers from "../engine/levers.js";
import type * as engine_mouthGuard from "../engine/mouthGuard.js";
import type * as engine_qualify from "../engine/qualify.js";
import type * as engine_safeTemplates from "../engine/safeTemplates.js";
import type * as engine_types from "../engine/types.js";
import type * as harness from "../harness.js";
import type * as harnessOps from "../harnessOps.js";
import type * as lib_cards from "../lib/cards.js";
import type * as messages from "../messages.js";
import type * as negotiate from "../negotiate.js";
import type * as offers from "../offers.js";
import type * as pipeline from "../pipeline.js";
import type * as receipt from "../receipt.js";
import type * as seed from "../seed.js";
import type * as verifyLive from "../verifyLive.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  agent: typeof agent;
  "agent/contract": typeof agent_contract;
  "agent/decide": typeof agent_decide;
  "agent/verify": typeof agent_verify;
  dealCard: typeof dealCard;
  deals: typeof deals;
  "engine/clamp": typeof engine_clamp;
  "engine/fixtures": typeof engine_fixtures;
  "engine/grounding": typeof engine_grounding;
  "engine/index": typeof engine_index;
  "engine/ledger": typeof engine_ledger;
  "engine/levers": typeof engine_levers;
  "engine/mouthGuard": typeof engine_mouthGuard;
  "engine/qualify": typeof engine_qualify;
  "engine/safeTemplates": typeof engine_safeTemplates;
  "engine/types": typeof engine_types;
  harness: typeof harness;
  harnessOps: typeof harnessOps;
  "lib/cards": typeof lib_cards;
  messages: typeof messages;
  negotiate: typeof negotiate;
  offers: typeof offers;
  pipeline: typeof pipeline;
  receipt: typeof receipt;
  seed: typeof seed;
  verifyLive: typeof verifyLive;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
