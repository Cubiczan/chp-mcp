#!/usr/bin/env bash
# Publish @cubiczan/chp-mcp MCPB bundle to Smithery (stdio release).
#
# Docs: https://smithery.ai/docs/concepts/cli
#   npm install -g smithery@latest   # Node 20+
#   smithery auth login
#   smithery mcp publish ./server.mcpb -n org/server
set -euo pipefail
cd "$(dirname "$0")/.."

QUALIFIED_NAME="${SMITHERY_QUALIFIED_NAME:-icohangar-ops/chp-mcp}"
VERSION="$(node -p "require('./package.json').version")"
BUNDLE="${1:-dist/chp-mcp-${VERSION}.mcpb}"

if ! command -v smithery >/dev/null 2>&1; then
  echo "Install Smithery CLI (Node 20+): npm install -g smithery@latest"
  exit 1
fi

if [[ ! -f "${BUNDLE}" ]]; then
  echo "Bundle not found: ${BUNDLE}"
  echo "Run: npm run mcpb:pack"
  exit 1
fi

if ! smithery auth whoami >/dev/null 2>&1; then
  echo "Authenticate first: smithery auth login"
  echo "  https://smithery.ai/docs/concepts/cli#auth"
  exit 1
fi

echo "Publishing stdio MCPB -> ${QUALIFIED_NAME}"
echo "  bundle: ${BUNDLE}"
smithery mcp publish "${BUNDLE}" -n "${QUALIFIED_NAME}"

echo
echo "Resume after OAuth (if publish paused): smithery mcp publish --resume -n ${QUALIFIED_NAME}"
