import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { db } from "@questlog/core/db/index.js";
import { createLocalFilesystemStorage } from "@questlog/core/services/storage.service.js";
import { createMcpServer } from "@questlog/mcp/server.js";

const storage = createLocalFilesystemStorage({
	basePath: process.env.UPLOAD_PATH ?? "uploads",
});
const server = createMcpServer({ db, storage });

await server.connect(new StdioServerTransport());
