/**
 * Real end-to-end retrieval proof for the query_lore MCP tool, mirroring
 * apps/server/src/services/search.e2e.test.ts: uploads the permanent
 * ashfall-primer.md fixture through the real server pipeline (extract →
 * chunk → embed via real Voyage), then calls query_lore through a real MCP
 * Client connected over the SDK's in-memory transport pair.
 *
 * Requires VOYAGE_API_KEY. Skips cleanly when absent.
 */
import { readFileSync } from "node:fs";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createTestDb } from "@questlog/server/db/test-helpers.js";
import { createMcpServer } from "@questlog/server/mcp/server.js";
import { buildApp } from "@questlog/server/server.js";
import { campaignService } from "@questlog/server/services/campaign.service.js";
import { sourceService } from "@questlog/server/services/source.service.js";
import { createMemoryStorage } from "@questlog/server/services/storage.service.js";
import dotenv from "dotenv";
import { sql } from "drizzle-orm";
import FormData from "form-data";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";

dotenv.config({ path: "../../.env" });

const { db, close } = createTestDb();
const storage = createMemoryStorage();

const FIXTURE_PATH = new URL(
	"../../server/src/test-fixtures/ashfall-primer.md",
	import.meta.url,
);

async function waitForStatus(
	sourceId: string,
	target: string,
	timeoutMs = 15_000,
): Promise<string> {
	const start = Date.now();
	let lastStatus = "";
	while (Date.now() - start < timeoutMs) {
		const source = await sourceService.getById(db, sourceId);
		lastStatus = source.status;
		if (lastStatus === target || lastStatus === "error") return lastStatus;
		await new Promise((resolve) => setTimeout(resolve, 100));
	}
	return lastStatus;
}

describe.skipIf(!process.env.VOYAGE_API_KEY)(
	"query_lore — real end-to-end retrieval (T-001)",
	() => {
		let campaignId: string;

		afterAll(async () => {
			await close();
		});

		beforeEach(async () => {
			await db.execute(sql`BEGIN`);
			const campaign = await campaignService.create(db, {
				name: "Ashfall Primer Test Campaign",
				theme: "fantasy",
			});
			campaignId = campaign.id;
		});

		afterEach(async () => {
			await db.execute(sql`ROLLBACK`);
		});

		it("returns content containing Duskwood for a query targeting the warden", async () => {
			const app = buildApp({ db, storage, autoProcessUploads: true });
			await app.ready();

			const fixtureContent = readFileSync(FIXTURE_PATH);
			const form = new FormData();
			form.append("file", fixtureContent, {
				filename: "ashfall-primer.md",
				contentType: "text/markdown",
			});

			const uploadResponse = await app.inject({
				method: "POST",
				url: `/api/campaigns/${campaignId}/sources/upload`,
				payload: form.getBuffer(),
				headers: form.getHeaders(),
			});
			expect(uploadResponse.statusCode).toBe(200);
			const { source } = uploadResponse.json();

			const finalStatus = await waitForStatus(source.id, "done");
			expect(finalStatus).toBe("done");

			const mcpServer = createMcpServer({ db });
			const client = new Client({ name: "test-client", version: "0.0.0" });
			const [clientTransport, serverTransport] =
				InMemoryTransport.createLinkedPair();
			await Promise.all([
				client.connect(clientTransport),
				mcpServer.connect(serverTransport),
			]);

			const result = await client.callTool({
				name: "query_lore",
				arguments: {
					campaignId,
					query: "Who patrols the road and investigates disappearances?",
				},
			});

			expect(result.isError).toBeFalsy();
			const content = result.content as Array<{ type: string; text: string }>;
			expect(content[0]?.text).toContain("Duskwood");

			await app.close();
		}, 30_000);
	},
);
