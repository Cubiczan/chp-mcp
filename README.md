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
| `evaluate_spend_gate` | `evaluateGate` | LOCKED / HITL_REQUIRED / BLOCKED + claims + content hash |
| `approve_spend` | `approveHuman` | Human lock when HITL_REQUIRED (cannot override hard fails) |
| `chp_content_hash` | `contentHash` | Float-aware canonical SHA-256 |
| `chp_version` | — | Server + protocol versions |

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
