import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { db } from "@questlog/core/db/index.js";
import { createMcpServer } from "@questlog/mcp/server.js";

const server = createMcpServer({ db });

await server.connect(new StdioServerTransport());
