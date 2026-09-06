# `@cubiczan/chp-mcp`

[![icohangar-ops/cubiczan-chp-mcp MCP server](https://glama.ai/mcp/servers/icohangar-ops/cubiczan-chp-mcp/badges/score.svg)](https://glama.ai/mcp/servers/icohangar-ops/cubiczan-chp-mcp)


One-command MCP install for **CHP Profile B** spend / capital gates.

[![MCP Registry](https://img.shields.io/badge/MCP_Registry-io.github.icohangar--ops%2Fchp--mcp-00C4B4)](https://registry.modelcontextprotocol.io)
[![npm](https://img.shields.io/npm/v/@cubiczan/chp-mcp)](https://www.npmjs.com/package/@cubiczan/chp-mcp)
[![Conformance](https://img.shields.io/badge/CHP_Profile_B-30%2F30-brightgreen)](https://github.com/icohangar-ops/cubiczan-chp)

Wraps [`@cubiczan/chp`](https://www.npmjs.com/package/@cubiczan/chp) so Cursor,
Claude Code, or any MCP client can call `evaluate_spend_gate` without vendoring
protocol code. Engine digests match the normative golden vectors
(**Profile B 30/30**).

## How the pieces fit

```text
MCP client (Cursor / Claude / …)
        │  tools/call
        ▼
┌───────────────────────────┐
│  MCP server (transport)   │  ← you are here (@cubiczan/chp-mcp)
│  evaluate_spend_gate      │
│  approve_spend            │
│  request_authorization    │
│  place_equity_order       │  scoped + receipt-gated (synthetic)
│  wire_treasury_transfer   │
│  rebalance_portfolio      │
│  inspect_audit_ledger     │  CHP-signed deny / authorize / execute
│  chp_content_hash         │
└─────────────┬─────────────┘
              │ depends on
              ▼
┌───────────────────────────┐
│  Published CHP packages   │
│  npm:  @cubiczan/chp                 (Profile B)
│  PyPI: consensus-hardening-protocol  (Profile A)
└───────────────────────────┘
```

For AGENTS.md + skills + Profile A `decision_gate` / `decision_adversary`, use
[agent-conductor](https://github.com/icohangar-ops/agent-conductor) instead.

## Install

```bash
npm install -g @cubiczan/chp-mcp
# or one-shot
npx -y @cubiczan/chp-mcp
```

### Cursor / Claude Desktop

```json
{
  "mcpServers": {
    "chp": {
      "command": "npx",
      "args": ["-y", "@cubiczan/chp-mcp"]
    }
  }
}
```

### Claude Code

```bash
claude mcp add chp -- npx -y @cubiczan/chp-mcp
```

## Tools

| Tool | Maps to | Purpose |
|------|---------|---------|
| `evaluate_spend_gate` | `evaluateGate` | LOCKED / HITL_REQUIRED / BLOCKED + claims + content hash. `BLOCKED` is also a ledgered `policy_deny`. |
| `approve_spend` | `approveHuman` | Human lock when HITL_REQUIRED (cannot override hard fails). Optional `tool` + `bound_args` mint a signed receipt. |
| `request_authorization` | runtime | Mint a receipt bound to a scoped reference tool, or return HITL / structured deny |
| `place_equity_order` | reference | Synthetic equity order — scope `trading:equities:place`, receipt required |
| `wire_treasury_transfer` | reference | Synthetic treasury wire — scope `treasury:wire`, always HITL |
| `rebalance_portfolio` | reference | Synthetic rebalance — scope `portfolio:rebalance` |
| `inspect_audit_ledger` | ledger | Trailing CHP-chained deny / authorize / execute entries |
| `chp_content_hash` | `contentHash` | Float-aware canonical SHA-256 |
| `chp_version` | — | Server + protocol versions + deny reason codes |

### Example — evaluate a spend

```jsonc
// tools/call evaluate_spend_gate
{
  "action": { "action": "LONG", "asset": "ETH", "notional": 300, "confidence": 0.9 },
  "policy": {
    "max_notional": 500,
    "daily_cap": 2500,
    "hitl_threshold": 250,
    "min_confidence": 0.55,
    "allowed_actions": ["LONG", "SHORT"]
  }
}
```

## Cookbook — deny telemetry and receipts

MCP denials are usually a bare error string. That string is gone when the
client disconnects. This server treats a refuse as a **structured event**
that must hit a CHP-signed ledger *before* the caller sees it.

### Reason codes

| Code | When |
|------|------|
| `policy_deny` | Hard CHP rule failed (`max_notional`, daily cap, …) |
| `expired` | Receipt `expires_at` is in the past |
| `replay` | Receipt already consumed by a successful execute |
| `args_changed` | Tool, scope, or args hash no longer matches the receipt |
| `missing_receipt` | No receipt, or the content hash does not verify |
| `ambiguous_policy` | Unknown tool, scope mismatch, or incomplete policy |

Signing is the existing Profile B primitives: `contentHash` on the
receipt / ledger payload, `chainHash` between ledger rows. Set
`CHP_AUDIT_LEDGER` to a JSONL path (default `./data/chp-audit.jsonl`),
or `:memory:` for tests.

### 1. Request a bound receipt

Under the HITL threshold the gate auto-locks and mints a receipt. At or
above it, pass `approver` (or call `approve_spend` with `tool` +
`bound_args`).

```jsonc
// tools/call request_authorization
{
  "tool": "place_equity_order",
  "args": {
    "symbol": "AAPL",
    "side": "BUY",
    "quantity": 10,
    "notional": 300,
    "confidence": 0.9
  },
  "approver": "cfo@example.com"
}
```

Treasury wires use `hitl_threshold: 0`. A request without `approver`
returns `HITL_REQUIRED` and **no** receipt — that is the approval gate,
not a weather-API demo.

### 2. Execute only with that receipt

`receipt` is optional on the wire so a missing token is a logged
`missing_receipt` deny, not a schema 400 that never hits the ledger.

```jsonc
// tools/call place_equity_order
{
  "symbol": "AAPL",
  "side": "BUY",
  "quantity": 10,
  "notional": 300,
  "confidence": 0.9,
  "receipt": { "kind": "authorization", "receipt_id": "…", "content_hash": "…" }
}
```

Change `notional` or `quantity` after approve → `args_changed`, and the
ledger has the deny. Call again with the same receipt → `replay`.
Call with no receipt → `missing_receipt`. All three are durable.

### 3. Inspect the chain

```jsonc
// tools/call inspect_audit_ledger
{ "limit": 20 }
```

Each row carries `content_hash` and `sig = chainHash(prev_sig, { seq, ts, event, content_hash })`.
`chain.ok` is false if anyone rewrote history.

### Tests

```bash
npm test
```

Invariants covered: an unlogged deny is impossible (ledger failure
throws instead of returning a deny object); changed args after approve
deny; a receipt is required for every gated reference tool.

## Related

| Package / repo | Role |
|----------------|------|
| [`@cubiczan/chp`](https://www.npmjs.com/package/@cubiczan/chp) | Profile B library (this server’s dependency) |
| [`consensus-hardening-protocol`](https://pypi.org/project/consensus-hardening-protocol/) | Profile A + normative spec |
| [`@cubiczan/agent-conductor`](https://www.npmjs.com/package/@cubiczan/agent-conductor) | Full MCP: contracts, skills, Profile A gates |
| [`@cubiczan/governed-mcp-gateway`](https://www.npmjs.com/package/@cubiczan/governed-mcp-gateway) | HTTP MCP control plane |
| [`@cubiczan/codesentinel-mcp`](https://www.npmjs.com/package/@cubiczan/codesentinel-mcp) | Codebase health MCP |
| [`cubiczan-resilience`](https://pypi.org/project/cubiczan-resilience/) / [`@cubiczan/resilience`](https://www.npmjs.com/package/@cubiczan/resilience) | Shared retry / timeout / audit primitives |

## Licence

MIT.
