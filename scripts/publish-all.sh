#!/usr/bin/env bash
# Run in your own terminal (needs browser OTP + GitHub device login).
set -euo pipefail

wait_npm_root() {
  local pkg="$1"
  local enc
  enc=$(python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1], safe=''))" "$pkg")
  echo "Waiting for package root $pkg ..."
  for i in $(seq 1 30); do
    code=$(curl -s -o /dev/null -w '%{http_code}' "https://registry.npmjs.org/$enc")
    if [ "$code" = "200" ]; then
      echo "root ready ($code)"
      return 0
    fi
    echo "  attempt $i: $code — sleep 3s"
    sleep 3
  done
  echo "WARN: root still not 200; version tarball may still be installable. Continuing."
  return 0
}

echo "== npm: @cubiczan/chp-mcp =="
cd ~/Desktop/cubiczan-chp-mcp
npm whoami
npm publish --access public
wait_npm_root "@cubiczan/chp-mcp"
npm view @cubiczan/chp-mcp version || true

echo "== npm: @cubiczan/agent-conductor =="
cd ~/Desktop/icohangar-repos/agent-conductor
npm whoami
npm publish --access public
wait_npm_root "@cubiczan/agent-conductor"
npm view @cubiczan/agent-conductor version || true

echo "== MCP Registry (GitHub device login as icohangar-ops) =="
mcp-publisher login github
cd ~/Desktop/cubiczan-chp-mcp && mcp-publisher publish
cd ~/Desktop/icohangar-repos/agent-conductor && mcp-publisher publish

echo "== verify =="
curl -s "https://registry.modelcontextprotocol.io/v0.1/servers?search=chp" | head -c 800; echo
curl -s "https://registry.modelcontextprotocol.io/v0.1/servers?search=agent-conductor" | head -c 800; echo
echo "DONE"
