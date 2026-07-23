import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { db } from "@questlog/server/db/index.js";
import { createMcpServer } from "@questlog/server/mcp/server.js";

const server = createMcpServer({ db });

await server.connect(new StdioServerTransport());
