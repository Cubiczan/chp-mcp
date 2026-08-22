#!/usr/bin/env node
/**
 * @cubiczan/chp-mcp — stdio MCP entrypoint.
 *
 * One-tool-install Profile B spend gate for Cursor / Claude / any MCP client:
 *   npx -y @cubiczan/chp-mcp
 */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";

const server = createServer();
const transport = new StdioServerTransport();

function shutdown(): void {
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
process.stdin.on("end", shutdown);

await server.connect(transport);
