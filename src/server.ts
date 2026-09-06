/**
 * CHP Profile B MCP server — spend gate + signed deny/authorization receipts.
 *
 * Tools:
 *   evaluate_spend_gate     — policy gate on a proposed action
 *   approve_spend           — human approval when HITL_REQUIRED
 *   request_authorization   — mint a bound receipt (or HITL / structured deny)
 *   place_equity_order      — synthetic gated equity order
 *   wire_treasury_transfer  — synthetic gated treasury wire
 *   rebalance_portfolio     — synthetic gated portfolio rebalance
 *   inspect_audit_ledger    — CHP-chained deny / authorize / execute log
 *   chp_content_hash        — float-aware canonical content hash
 *   chp_version             — package / protocol versions
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { version: PKG_VERSION } = require("../package.json") as { version: string };
import { CHP_VERSION, contentHash, type GatePolicy, type ProposedAction } from "@cubiczan/chp";
import { type AuthorizationReceipt, openLedger } from "./audit.js";
import { createRuntime, type ChpRuntime } from "./runtime.js";

function jsonContent(data: unknown, isError = false) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
    ...(isError ? { isError: true } : {}),
  };
}

function errorContent(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return {
    content: [{ type: "text" as const, text: JSON.stringify({ error: message }) }],
    isError: true,
  };
}

const policySchema = z.object({
  version: z.string().optional(),
  max_notional: z.number(),
  daily_cap: z.number(),
  hitl_threshold: z.number(),
  min_confidence: z.number(),
  allowed_actions: z.array(z.string()).optional(),
  per_asset_limits: z.record(z.number()).optional(),
});

const actionSchema = z.object({
  action: z.string(),
  asset: z.string(),
  notional: z.number(),
  confidence: z.number().nullable().optional(),
  rationale: z.string().optional(),
});

const authorizationReceiptSchema = z.object({
  kind: z.literal("authorization"),
  receipt_id: z.string(),
  tool: z.string(),
  scope: z.string(),
  args_hash: z.string(),
  issued_at: z.string(),
  expires_at: z.string(),
  approver: z.string(),
  nonce: z.string(),
  content_hash: z.string(),
});

export interface CreateServerOptions {
  runtime?: ChpRuntime;
}

export function createServer(options: CreateServerOptions = {}): McpServer {
  const runtime = options.runtime ?? createRuntime({ ledger: openLedger() });
  const server = new McpServer({
    name: "chp-mcp",
    version: PKG_VERSION,
  });

  server.tool(
    "evaluate_spend_gate",
    "Run CHP Profile B capital/spend gate on a proposed action. Returns LOCKED, " +
      "HITL_REQUIRED, or BLOCKED with claims and a content hash. Hard policy " +
      "violations cannot be overridden by a human. BLOCKED is also written as a " +
      "structured policy_deny to the CHP-signed audit ledger.",
    {
      action: actionSchema.describe("Proposed trade / spend / mandate action"),
      policy: policySchema.describe("Gate policy (limits, HITL threshold, confidence floor)"),
      committed_today: z
        .number()
        .optional()
        .describe("Notional already committed today toward daily_cap (default 0)"),
    },
    async ({ action, policy, committed_today }) => {
      try {
        return jsonContent(
          runtime.evaluateSpend(action as ProposedAction, policy as GatePolicy, committed_today ?? 0),
        );
      } catch (error) {
        return errorContent(error);
      }
    },
  );

  server.tool(
    "approve_spend",
    "Human-in-the-loop approval for a proposal that returned HITL_REQUIRED. " +
      "Cannot approve BLOCKED / hard-rule failures (spec §6.3 / §6.5). " +
      "When tool + bound_args are supplied, mints a signed authorization receipt.",
    {
      action: actionSchema,
      policy: policySchema,
      approver: z.string().describe("Human approver identity (email or handle)"),
      committed_today: z.number().optional(),
      tool: z
        .string()
        .optional()
        .describe("Reference tool to bind the receipt to (e.g. place_equity_order)"),
      scope: z.string().optional(),
      bound_args: z.record(z.unknown()).optional().describe("Canonical args the receipt will authorize"),
      ttl_seconds: z.number().optional().describe("Receipt lifetime (default 300)"),
    },
    async ({ action, policy, approver, committed_today, tool, scope, bound_args, ttl_seconds }) => {
      try {
        const bind =
          tool && bound_args
            ? { tool, scope, args: bound_args as Record<string, unknown>, ttlSeconds: ttl_seconds }
            : undefined;
        return jsonContent(
          runtime.approveSpend(
            action as ProposedAction,
            policy as GatePolicy,
            approver,
            committed_today ?? 0,
            bind,
          ),
        );
      } catch (error) {
        return errorContent(error);
      }
    },
  );

  server.tool(
    "request_authorization",
    "Request a signed authorization receipt for a scoped reference tool " +
      "(place_equity_order, wire_treasury_transfer, rebalance_portfolio). " +
      "Auto-lock mints a receipt; HITL_REQUIRED waits for approver; hard fails " +
      "return a structured deny that is already on the audit ledger.",
    {
      tool: z
        .string()
        .describe("Gated reference tool name"),
      args: z.record(z.unknown()).describe("Tool args that will be bound into the receipt"),
      policy: policySchema.optional(),
      scope: z.string().optional(),
      approver: z.string().optional().describe("Required when the gate returns HITL_REQUIRED"),
      committed_today: z.number().optional(),
      ttl_seconds: z.number().optional(),
    },
    async ({ tool, args, policy, scope, approver, committed_today, ttl_seconds }) => {
      try {
        const result = runtime.requestAuthorization({
          tool,
          args: args as Record<string, unknown>,
          policy,
          scope,
          approver,
          committedToday: committed_today,
          ttlSeconds: ttl_seconds,
        });
        return jsonContent(result, result.ok === false && !("pending" in result && result.pending));
      } catch (error) {
        return errorContent(error);
      }
    },
  );

  server.tool(
    "place_equity_order",
    "Synthetic equity order (scope trading:equities:place). No live venue. " +
      "Requires a signed authorization receipt bound to these args. Receipt is " +
      "optional on the wire so a missing receipt becomes a logged missing_receipt deny.",
    {
      symbol: z.string(),
      side: z.enum(["BUY", "SELL"]),
      quantity: z.number(),
      notional: z.number(),
      limit_price: z.number().optional(),
      confidence: z.number().optional(),
      rationale: z.string().optional(),
      receipt: authorizationReceiptSchema.optional(),
    },
    async (args) => {
      try {
        const { receipt, ...order } = args;
        const result = runtime.executeGated(
          "place_equity_order",
          order as Record<string, unknown>,
          receipt as AuthorizationReceipt | undefined,
        );
        return jsonContent(result, !result.ok);
      } catch (error) {
        return errorContent(error);
      }
    },
  );

  server.tool(
    "wire_treasury_transfer",
    "Synthetic treasury wire (scope treasury:wire). Default policy always " +
      "requires a human-issued receipt. No live bank rail. Missing receipt is a " +
      "logged deny, not a bare MCP error string.",
    {
      from_account: z.string(),
      to_account: z.string(),
      amount: z.number(),
      currency: z.string().optional(),
      memo: z.string().optional(),
      confidence: z.number().optional(),
      receipt: authorizationReceiptSchema.optional(),
    },
    async (args) => {
      try {
        const { receipt, ...wire } = args;
        const result = runtime.executeGated(
          "wire_treasury_transfer",
          wire as Record<string, unknown>,
          receipt as AuthorizationReceipt | undefined,
        );
        return jsonContent(result, !result.ok);
      } catch (error) {
        return errorContent(error);
      }
    },
  );

  server.tool(
    "rebalance_portfolio",
    "Synthetic portfolio rebalance (scope portfolio:rebalance). No live desk. " +
      "Requires a signed authorization receipt; HITL at/above $1,000 notional.",
    {
      portfolio_id: z.string(),
      target_weights: z.record(z.number()).optional(),
      notional: z.number(),
      confidence: z.number().optional(),
      receipt: authorizationReceiptSchema.optional(),
    },
    async (args) => {
      try {
        const { receipt, ...rebalance } = args;
        const result = runtime.executeGated(
          "rebalance_portfolio",
          rebalance as Record<string, unknown>,
          receipt as AuthorizationReceipt | undefined,
        );
        return jsonContent(result, !result.ok);
      } catch (error) {
        return errorContent(error);
      }
    },
  );

  server.tool(
    "inspect_audit_ledger",
    "Read the CHP-signed deny / authorize / execute ledger and verify the chain. " +
      "Also lists the synthetic scoped reference tools.",
    {
      limit: z.number().optional().describe("Max trailing entries (default 50)"),
    },
    async ({ limit }) => {
      try {
        return jsonContent(runtime.inspectLedger(limit ?? 50));
      } catch (error) {
        return errorContent(error);
      }
    },
  );

  server.tool(
    "chp_content_hash",
    "SHA-256 over float-aware canonical JSON (CHP §3.1) — matches Python " +
      "consensus-hardening-protocol digests for the same object.",
    {
      value: z.unknown().describe("JSON-serializable value to hash"),
    },
    async ({ value }) => {
      try {
        return jsonContent({ content_hash: contentHash(value) });
      } catch (error) {
        return errorContent(error);
      }
    },
  );

  server.tool(
    "chp_version",
    "Report MCP server and CHP Profile B protocol versions.",
    {},
    async () =>
      jsonContent({
        mcp: `@cubiczan/chp-mcp@${PKG_VERSION}`,
        chp_profile: "B",
        chp_version: CHP_VERSION,
        engine: "@cubiczan/chp",
        deny_reason_codes: [
          "policy_deny",
          "expired",
          "replay",
          "args_changed",
          "missing_receipt",
          "ambiguous_policy",
        ],
      }),
  );

  return server;
}

export { createRuntime, ChpRuntime } from "./runtime.js";
export { MemoryLedger, FileLedger, openLedger } from "./audit.js";
