import { chunks, sources } from "@questlog/core/db/schema/index.js";
import {
	basisVector,
	deleteCampaignTree,
} from "@questlog/core/db/test-helpers.js";
import { campaignService } from "@questlog/core/services/campaign.service.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { connectedClient, createMockFetch, db } from "../test-helpers.js";

describe("get_chunk_history tool (T-152)", () => {
	// confirm_correct_lore opens its own db.transaction() (via
	// writeRequestService.confirm), which does not compose with a raw
	// BEGIN/ROLLBACK wrapper on the same connection (.claude/rules/backend.md
	// "Test DB pattern") — use explicit FK-safe cleanup instead.
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
			.values({
				campaignId,
				name: "primer.md",
				type: "paste",
				status: "done",
			})
			.returning();
		sourceId = source?.id ?? "";
	});

	afterEach(async () => {
		await deleteCampaignTree(db, campaignId);
	});

	it("returns the correction event for a seeded superseded chunk via the full MCP handler path", async () => {
		const [activeA] = await db
			.insert(chunks)
			.values([
				{
					campaignId,
					sourceId,
					content: "Mira was born in Ashfall.",
					status: "active",
				},
			])
			.returning();

		const client = await connectedClient(createMockFetch(basisVector(0)));
		const previewResult = await client.callTool({
			name: "correct_lore",
			arguments: {
				campaignId,
				sourceId,
				correctionText: "Mira was born in Thornwall, not Ashfall.",
			},
		});
		const previewContent = previewResult.content as Array<{
			type: string;
			text: string;
		}>;
		const { token } = JSON.parse(previewContent[0]?.text ?? "{}");
		await client.callTool({
			name: "confirm_correct_lore",
			arguments: { token },
		});

		const result = await client.callTool({
			name: "get_chunk_history",
			arguments: { campaignId, chunkId: activeA?.id },
		});

		expect(result.isError).toBeFalsy();
		const content = result.content as Array<{ type: string; text: string }>;
		const payload = JSON.parse(content[0]?.text ?? "{}");
		expect(payload).toHaveLength(1);
		expect(payload[0].correctionText).toBe(
			"Mira was born in Thornwall, not Ashfall.",
		);
		expect(payload[0].supersededChunkIds).toContain(activeA?.id);
	});

	it("returns [] for a chunk with no correction history", async () => {
		const [activeA] = await db
			.insert(chunks)
			.values([
				{
					campaignId,
					sourceId,
					content: "Mira was born in Ashfall.",
					status: "active",
				},
			])
			.returning();

		const client = await connectedClient(createMockFetch(basisVector(0)));
		const result = await client.callTool({
			name: "get_chunk_history",
			arguments: { campaignId, chunkId: activeA?.id },
		});

		expect(result.isError).toBeFalsy();
		const content = result.content as Array<{ type: string; text: string }>;
		expect(JSON.parse(content[0]?.text ?? "null")).toEqual([]);
	});
});
