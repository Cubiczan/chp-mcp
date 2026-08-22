#!/usr/bin/env bash
# Publish @cubiczan/chp-mcp MCPB bundle to Smithery (stdio release).
#
# Docs: https://smithery.ai/docs/concepts/cli
# Namespace: must exist on Smithery (smithery namespace show / create)
set -euo pipefail
cd "$(dirname "$0")/.."

SERVER_SLUG="${SMITHERY_SERVER_SLUG:-chp-mcp}"
VERSION="$(node -p "require('./package.json').version")"
BUNDLE="${1:-dist/chp-mcp-${VERSION}.mcpb}"

if [[ -n "${SMITHERY_QUALIFIED_NAME:-}" ]]; then
  QUALIFIED_NAME="${SMITHERY_QUALIFIED_NAME}"
else
  NS="$(smithery namespace show 2>/dev/null | awk '/Namespace:/ {print $2}')"
  if [[ -z "${NS}" ]]; then
    echo "Could not read Smithery namespace. Run: smithery auth login && smithery namespace show"
    echo "Or set SMITHERY_QUALIFIED_NAME=your-namespace/chp-mcp"
    exit 1
  fi
  QUALIFIED_NAME="${NS}/${SERVER_SLUG}"
fi

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
  exit 1
fi

echo "Publishing stdio MCPB -> ${QUALIFIED_NAME}"
echo "  bundle: ${BUNDLE}"
if ! smithery mcp publish "${BUNDLE}" -n "${QUALIFIED_NAME}"; then
  echo
  echo "If you saw 'Namespace not found':"
  echo "  smithery namespace create icohangar-ops   # once, to match GitHub org"
  echo "  smithery namespace use icohangar-ops"
  echo "  SMITHERY_QUALIFIED_NAME=icohangar-ops/chp-mcp npm run smithery:publish"
  exit 1
fi

echo
echo "Resume after OAuth: smithery mcp publish --resume -n ${QUALIFIED_NAME}"
