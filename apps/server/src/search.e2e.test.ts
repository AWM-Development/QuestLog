/**
 * T-000 — real end-to-end retrieval proof.
 *
 * Unlike search.service.test.ts (synthetic basis-vector embeddings, mocked
 * fetch) and routers/search.test.ts (mocked search service entirely),
 * this test uses the REAL Voyage API against a permanent fixture
 * (test-fixtures/ashfall-primer.md) and proves the full path:
 *
 *   upload (real multipart POST, autoProcessUploads: true)
 *     → extract → chunk → embed (real Voyage)
 *     → search.searchSources (real tRPC path)
 *     → top result is the semantically relevant chunk
 *
 * Requires VOYAGE_API_KEY. Loads repo-root .env the same way migrate.ts
 * does (dotenv does not override an already-set env var, so CI's
 * workflow-injected VOYAGE_API_KEY still wins there). Skips cleanly when the
 * key is absent rather than failing, so a fork/environment without it isn't
 * blocked.
 */
import { readFileSync } from "node:fs";
import { createTestDb } from "@questlog/core/db/test-helpers.js";
import { campaignService } from "@questlog/core/services/campaign.service.js";
import { sourceService } from "@questlog/core/services/source.service.js";
import { createMemoryStorage } from "@questlog/core/services/storage.service.js";
import dotenv from "dotenv";
import { sql } from "drizzle-orm";
import FormData from "form-data";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "./server.js";

dotenv.config({ path: "../../.env" });

const { db, close } = createTestDb();
const storage = createMemoryStorage();

const FIXTURE_PATH = new URL(
	"./test-fixtures/ashfall-primer.md",
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
	"search — real end-to-end retrieval (T-000)",
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

		it("returns the semantically relevant chunk for distinct queries against the fixture", async () => {
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

			async function topResultFor(query: string) {
				const response = await app.inject({
					method: "GET",
					url: `/trpc/search.searchSources?input=${encodeURIComponent(
						JSON.stringify({ json: { campaignId, query, limit: 3 } }),
					)}`,
				});
				expect(response.statusCode).toBe(200);
				const results = response.json().result.data.json as Array<{
					content: string;
				}>;
				expect(results.length).toBeGreaterThan(0);
				return results[0]?.content ?? "";
			}

			const wardenTop = await topResultFor(
				"Who patrols the road and investigates disappearances?",
			);
			expect(wardenTop).toContain("Duskwood");
			expect(wardenTop).not.toContain("Pyrraxes");

			const tavernTop = await topResultFor(
				"Where can travelers get information about the road ahead?",
			);
			expect(tavernTop.includes("Oskar") || tavernTop.includes("Griffon")).toBe(
				true,
			);
			expect(tavernTop).not.toContain("Pyrraxes");

			await app.close();
		}, 30_000);
	},
);
