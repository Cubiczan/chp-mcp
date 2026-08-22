# Publish checklist — CHP MCP wedge

Repo is on GitHub: https://github.com/icohangar-ops/cubiczan-chp-mcp  
`mcpName` / `server.json` are ready for the official MCP Registry.

## 1) npm (requires your browser OTP)

```bash
cd ~/Desktop/cubiczan-chp-mcp
npm whoami          # expect: cubiczan
npm publish --access public
# Complete the npm auth/cli URL printed in the terminal, then re-run if needed.
npm view @cubiczan/chp-mcp version   # expect 0.1.0
```

Also publish Conductor (scoped — unscoped `agent-conductor` is taken):

```bash
cd ~/Desktop/icohangar-repos/agent-conductor
npm publish --access public
npm view @cubiczan/agent-conductor version
```

## 2) Official MCP Registry

```bash
# already installed at ~/.local/bin/mcp-publisher
mcp-publisher login github
# Open https://github.com/login/device and enter the code (use icohangar-ops)

cd ~/Desktop/cubiczan-chp-mcp
mcp-publisher publish
# → io.github.icohangar-ops/chp-mcp@0.1.0

cd ~/Desktop/icohangar-repos/agent-conductor
mcp-publisher publish
# → io.github.icohangar-ops/agent-conductor@0.1.0

curl "https://registry.modelcontextprotocol.io/v0.1/servers?search=chp"
curl "https://registry.modelcontextprotocol.io/v0.1/servers?search=agent-conductor"
```

## 3) Cursor / Claude one-liners (after npm)

```json
{
  "mcpServers": {
    "chp": { "command": "npx", "args": ["-y", "@cubiczan/chp-mcp"] },
    "conductor": { "command": "npx", "args": ["-y", "@cubiczan/agent-conductor"] }
  }
}
```

For Conductor `decision_*` tools also run once:

```bash
pip install consensus-hardening-protocol
```

## 4) awesome-mcp-servers PR (paste)

Open a PR against https://github.com/punkpeye/awesome-mcp-servers under **Security** or **Agent tooling**:

```markdown
- [chp-mcp](https://github.com/icohangar-ops/cubiczan-chp-mcp) - CHP Profile B spend/HITL gate (`evaluate_spend_gate`) over MCP — `npx -y @cubiczan/chp-mcp`
- [agent-conductor](https://github.com/icohangar-ops/agent-conductor) - AGENTS.md + skills + CHP Profile A R0/adversary gates over MCP
```

Optional second list: https://github.com/appcypher/awesome-mcp-servers

## 5) Already done

- [x] GitHub repo `icohangar-ops/cubiczan-chp-mcp`
- [x] `mcpName` + `server.json` on chp-mcp and agent-conductor
- [x] GitHub topics: `mcp`, `model-context-protocol`, `claude`, `cursor`, `governance`, `chp`
- [x] Cross-links + conformance notes in CHP / cubiczan-chp / conductor READMEs
- [x] PyPI `consensus-hardening-protocol` + npm `@cubiczan/chp`
