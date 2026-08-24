import { chunks, sources } from "@questlog/core/db/schema/index.js";
import {
	basisVector,
	deleteCampaignTree,
} from "@questlog/core/db/test-helpers.js";
import { campaignService } from "@questlog/core/services/campaign.service.js";
import { entityService } from "@questlog/core/services/entity.service.js";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { connectedClient, createMockFetch, db } from "../test-helpers.js";

describe("correct_lore tool (T-075)", () => {
	// createPreview writes a write_requests row (not a chunk mutation); use
	// deleteCampaignTree so FK cleanup covers that row too.
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

	it("previews a sourceId correction naming every non-superseded chunk, without mutating chunks", async () => {
		const [activeA, superseded, activeB] = await db
			.insert(chunks)
			.values([
				{
					campaignId,
					sourceId,
					content: "Mira was born in Ashfall.",
					status: "active",
				},
				{
					campaignId,
					sourceId,
					content: "Old wrong fact about Mira.",
					status: "superseded",
				},
				{
					campaignId,
					sourceId,
					content: "Mira patrols the Old Road.",
					status: "active",
				},
			])
			.returning();

		const client = await connectedClient(createMockFetch(basisVector(0)));
		const result = await client.callTool({
			name: "correct_lore",
			arguments: {
				campaignId,
				sourceId,
				correctionText: "Mira was born in Thornwall, not Ashfall.",
			},
		});

		expect(result.isError).toBeFalsy();
		const content = result.content as Array<{ type: string; text: string }>;
		const payload = JSON.parse(content[0]?.text ?? "{}");

		expect(payload.token).toBeDefined();
		expect(payload.preview.correctionText).toBe(
			"Mira was born in Thornwall, not Ashfall.",
		);
		expect(payload.preview.targetChunkIds).toEqual(
			expect.arrayContaining([activeA?.id, activeB?.id]),
		);
		expect(payload.preview.targetChunkIds).not.toContain(superseded?.id);
		expect(payload.preview.targetChunkIds).toHaveLength(2);
		expect(payload.preview.chunkPreview.count).toBeGreaterThan(0);
		expect(payload.preview.chunkPreview.firstChunkExcerpt).toContain(
			"Thornwall",
		);

		const chunkRows = await db
			.select({ id: chunks.id, status: chunks.status })
			.from(chunks)
			.where(eq(chunks.sourceId, sourceId));
		expect(chunkRows).toHaveLength(3);
		expect(chunkRows.filter((row) => row.status === "superseded")).toHaveLength(
			1,
		);
		expect(chunkRows.filter((row) => row.status === "active")).toHaveLength(2);
	});

	it("rejects more than one of entityId/sourceId/chunkIds, or none, before any DB call", async () => {
		const client = await connectedClient(createMockFetch(basisVector(0)));

		const bothResult = await client.callTool({
			name: "correct_lore",
			arguments: {
				campaignId,
				sourceId,
				entityId: "00000000-0000-4000-8000-000000000001",
				correctionText: "A correction.",
			},
		});
		expect(bothResult.isError).toBe(true);
		const bothContent = bothResult.content as Array<{
			type: string;
			text: string;
		}>;
		expect(bothContent[0]?.text).toMatch(
			/Exactly one of entityId, sourceId, or chunkIds/,
		);

		const neitherResult = await client.callTool({
			name: "correct_lore",
			arguments: {
				campaignId,
				correctionText: "A correction.",
			},
		});
		expect(neitherResult.isError).toBe(true);
		const neitherContent = neitherResult.content as Array<{
			type: string;
			text: string;
		}>;
		expect(neitherContent[0]?.text).toMatch(
			/Exactly one of entityId, sourceId, or chunkIds/,
		);
	});

	it("returns empty targetChunkIds when only entityId is provided (pure addition)", async () => {
		const entity = await entityService.create(db, {
			campaignId,
			name: "Mira Duskwood",
			type: "npc",
		});

		const client = await connectedClient(createMockFetch(basisVector(0)));
		const result = await client.callTool({
			name: "correct_lore",
			arguments: {
				campaignId,
				entityId: entity.id,
				correctionText: "Mira now carries a silver dagger.",
			},
		});

		expect(result.isError).toBeFalsy();
		const content = result.content as Array<{ type: string; text: string }>;
		const payload = JSON.parse(content[0]?.text ?? "{}");
		expect(payload.token).toBeDefined();
		expect(payload.preview.entityId).toBe(entity.id);
		expect(payload.preview.targetChunkIds).toEqual([]);
	});
});
