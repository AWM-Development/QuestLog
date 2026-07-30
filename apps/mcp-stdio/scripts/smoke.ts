import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import {
	StdioClientTransport,
	getDefaultEnvironment,
} from "@modelcontextprotocol/sdk/client/stdio.js";
import {
	EXPECTED_TOOLS,
	withTimeout,
} from "@questlog/shared/testing/mcp-verification.js";

// Spawns the *built* dist/main.js over stdio, the same way a real MCP
// client (e.g. Claude Desktop) would — proof the documented setup actually
// boots, distinct from server.test.ts's in-process InMemoryTransport pair,
// which never exercises main.ts, dist/, or a real child process transport.

const HANDSHAKE_TIMEOUT_MS = 15_000;

async function main() {
	if (!process.env.DATABASE_URL) {
		throw new Error(
			"DATABASE_URL is not set — the smoke test spawns the real server, which requires a running, migrated Postgres. See apps/mcp-stdio/README.md.",
		);
	}

	const __dirname = path.dirname(fileURLToPath(import.meta.url));
	const distEntry = path.resolve(__dirname, "../dist/main.js");

	const transport = new StdioClientTransport({
		command: "node",
		args: [distEntry],
		env: {
			...getDefaultEnvironment(),
			DATABASE_URL: process.env.DATABASE_URL,
			...(process.env.VOYAGE_API_KEY
				? { VOYAGE_API_KEY: process.env.VOYAGE_API_KEY }
				: {}),
		},
	});
	const client = new Client({ name: "questlog-mcp-smoke", version: "0.0.0" });

	await withTimeout(
		client.connect(transport),
		"MCP initialize handshake",
		HANDSHAKE_TIMEOUT_MS,
	);
	console.log(`Initialize handshake succeeded against ${distEntry}`);

	const { tools } = await withTimeout(
		client.listTools(),
		"tools/list",
		HANDSHAKE_TIMEOUT_MS,
	);
	const names = tools.map((tool) => tool.name).sort();
	console.log(`Server reported ${names.length} tool(s): ${names.join(", ")}`);

	const missing = EXPECTED_TOOLS.filter((name) => !names.includes(name));
	if (missing.length > 0) {
		throw new Error(`Missing expected tool(s): ${missing.join(", ")}`);
	}

	await client.close();
	console.log(
		"PASS — built dist/main.js boots over stdio and serves the full expected tool list.",
	);
}

main().catch((err) => {
	console.error("FAIL —", err instanceof Error ? err.message : err);
	process.exitCode = 1;
});
