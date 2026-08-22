#!/usr/bin/env bash
# Build a production MCPB bundle for Claude Desktop / Smithery stdio publish.
set -euo pipefail
cd "$(dirname "$0")/.."

VERSION="$(node -p "require('./package.json').version")"
OUT="dist/chp-mcp-${VERSION}.mcpb"

echo "==> build"
npm run build

echo "==> production deps only"
npm ci --omit=dev --no-audit --no-fund

echo "==> validate manifest"
mcpb validate manifest.json

echo "==> pack -> ${OUT}"
mkdir -p dist
mcpb pack . "${OUT}"

echo "==> smoke (initialize + tools/list)"
printf '%s\n' \
  '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"mcpb-pack-smoke","version":"0.0.0"}}}' \
  '{"jsonrpc":"2.0","method":"notifications/initialized"}' \
  '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}' \
| node dist/index.js > /tmp/chp-mcpb-smoke.ndjson
grep -q '"name":"chp-mcp"' /tmp/chp-mcpb-smoke.ndjson
grep -q 'evaluate_spend_gate' /tmp/chp-mcpb-smoke.ndjson
echo "OK: ${OUT} ($(du -h "${OUT}" | cut -f1))"

echo
echo "Smithery publish (https://smithery.ai/docs/concepts/cli):"
echo "  npm install -g smithery@latest"
echo "  smithery auth login"
echo "  npm run smithery:publish"
echo "  # or: smithery mcp publish ${OUT} -n icohangar-ops/chp-mcp"
