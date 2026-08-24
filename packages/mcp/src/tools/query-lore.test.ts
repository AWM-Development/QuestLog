import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	chunks,
	sources,
} from "@questlog/core/db/schema/index.js";
import { basisVector, deleteCampaignTree } from "@questlog/core/db/test-helpers.js";
import { campaignService } from "@questlog/core/services/campaign.service.js";
import { connectedClient, createMockFetch, db } from "../test-helpers.js";

describe("query_lore tool", () => {
	// query_lore assembles context via contextService.assemble, whose
	// keywordSearch opens its own db.transaction() (T-015's indexable trgm
	// operator rewrite) — this does not compose with a raw BEGIN/ROLLBACK
	// wrapper on the same connection (.claude/rules/backend.md "Test DB
	// pattern") — use explicit FK-safe cleanup instead.
	let campaignId: string;
	let sourceId: string;

	beforeEach(async () => {
		vi.clearAllMocks();

		const campaign = await campaignService.create(db, {
			name: "Ashfall Primer Campaign",
			theme: "fantasy",
		});
		campaignId = campaign.id;

		const [source] = await db
			.insert(sources)
			.values({ campaignId, name: "primer.md", type: "file", status: "done" })
			.returning();
		sourceId = source?.id ?? "";
	});

	afterEach(async () => {
		await deleteCampaignTree(db, campaignId);
	});

	it("returns the seeded chunk in citations with confidence > 0", async () => {
		const [chunk] = await db
			.insert(chunks)
			.values({
				campaignId,
				sourceId,
				content: "Mira Duskwood patrols the Old Road near Ashfall Peak.",
				embedding: basisVector(0),
				metadata: { position: 0 },
			})
			.returning();
		const chunkId = chunk?.id ?? "";

		const client = await connectedClient(createMockFetch(basisVector(0)));

		const result = await client.callTool({
			name: "query_lore",
			arguments: { campaignId, query: "Who patrols the road?" },
		});

		expect(result.isError).toBeFalsy();
		const content = result.content as Array<{ type: string; text: string }>;
		const payload = JSON.parse(content[0]?.text ?? "{}");
		expect(payload.citations).toEqual(
			expect.arrayContaining([expect.objectContaining({ chunkId, sourceId })]),
		);
		expect(payload.confidence).toBeGreaterThan(0);
	});

	it("returns isError for an unknown campaignId instead of throwing", async () => {
		const client = await connectedClient(createMockFetch(basisVector(0)));
		const unknownCampaignId = "00000000-0000-0000-0000-000000000000";

		const result = await client.callTool({
			name: "query_lore",
			arguments: { campaignId: unknownCampaignId, query: "anything" },
		});

		expect(result.isError).toBe(true);
		const content = result.content as Array<{ type: string; text: string }>;
		expect(content[0]?.text).toContain(unknownCampaignId);
	});
});
