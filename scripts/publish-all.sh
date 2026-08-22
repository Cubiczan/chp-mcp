#!/usr/bin/env bash
# Run in your own terminal (needs browser OTP + GitHub device login).
set -euo pipefail

echo "== npm: @cubiczan/chp-mcp =="
cd ~/Desktop/cubiczan-chp-mcp
npm whoami
npm publish --access public
npm view @cubiczan/chp-mcp version

echo "== npm: @cubiczan/agent-conductor =="
cd ~/Desktop/icohangar-repos/agent-conductor
npm publish --access public
npm view @cubiczan/agent-conductor version

echo "== MCP Registry (GitHub device login as icohangar-ops) =="
mcp-publisher login github
cd ~/Desktop/cubiczan-chp-mcp && mcp-publisher publish
cd ~/Desktop/icohangar-repos/agent-conductor && mcp-publisher publish

echo "== verify =="
curl -s "https://registry.modelcontextprotocol.io/v0.1/servers?search=chp" | head -c 500; echo
curl -s "https://registry.modelcontextprotocol.io/v0.1/servers?search=agent-conductor" | head -c 500; echo
echo "DONE"
