import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { Database } from "@questlog/core/db/index.js";
import { createLocalFilesystemStorage } from "@questlog/core/services/storage.service.js";
import { createMcpServer } from "@questlog/mcp/server.js";

function errorMessage(err: unknown): string {
	return err instanceof Error ? err.message : String(err);
}

export async function main(): Promise<void> {
	let storage: ReturnType<typeof createLocalFilesystemStorage>;
	try {
		storage = createLocalFilesystemStorage({
			basePath: process.env.UPLOAD_PATH ?? "uploads",
		});
	} catch (err) {
		console.error(
			`QuestLog MCP server failed to start — storage init failed: ${errorMessage(err)}`,
		);
		process.exit(1);
		return;
	}

	let db: Database;
	try {
		// Dynamic, not static: @questlog/core/db/index.js validates and opens
		// DATABASE_URL at module-evaluation time. A static top-level import
		// would throw before this function's try/catch ever runs, surfacing a
		// raw stack trace instead of the diagnosable message below — see
		// Docs/IMPLEMENTATION_NOTES.md § T-141.
		({ db } = await import("@questlog/core/db/index.js"));
	} catch (err) {
		console.error(
			`QuestLog MCP server failed to start — database init failed: ${errorMessage(err)}`,
		);
		process.exit(1);
		return;
	}

	const server = createMcpServer({ db, storage });

	try {
		await server.connect(new StdioServerTransport());
	} catch (err) {
		console.error(
			`QuestLog MCP server failed to start — server connect failed: ${errorMessage(err)}`,
		);
		process.exit(1);
		return;
	}

	console.error("QuestLog MCP server ready (stdio)");
}

if (import.meta.url === `file://${process.argv[1]}`) {
	await main();
}
