#!/usr/bin/env bash
# Build a production MCPB bundle for Claude Desktop / Smithery stdio publish.
set -euo pipefail
cd "$(dirname "$0")/.."

VERSION="$(node -p "require('./package.json').version")"
OUT="dist/chp-mcp-${VERSION}.mcpb"

echo "==> install (incl. dev deps for tsc)"
npm ci --no-audit --no-fund

echo "==> build"
npm run build

echo "==> production deps only (smaller bundle)"
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

NS="$(smithery namespace show 2>/dev/null | awk '/Namespace:/ {print $2}' || true)"
echo
echo "Smithery publish (https://smithery.ai/docs/concepts/cli):"
echo "  smithery auth login"
if [[ -z "${SMITHERY_QUALIFIED_NAME:-}" ]]; then
  echo "  # your namespace is: ${NS:-<run smithery namespace show>}"
  echo "  # claim org namespace once: smithery namespace create icohangar-ops"
  echo "  SMITHERY_QUALIFIED_NAME=${NS:-sam-ati8}/chp-mcp npm run smithery:publish"
else
  echo "  npm run smithery:publish"
fi
