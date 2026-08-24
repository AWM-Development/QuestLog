import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	chunkCorrections,
	chunks,
	sources,
} from "@questlog/core/db/schema/index.js";
import { basisVector, deleteCampaignTree } from "@questlog/core/db/test-helpers.js";
import { campaignService } from "@questlog/core/services/campaign.service.js";
import { connectedClient, createMockFetch, db } from "../test-helpers.js";
import { entityService } from "@questlog/core/services/entity.service.js";
import { eq } from "drizzle-orm";
import { writeRequestService } from "@questlog/core/services/write-request.service.js";

describe("confirm_correct_lore tool (T-076)", () => {
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

	it("atomically creates embedded correction chunks and supersedes every target", async () => {
		const [activeA, activeB] = await db
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
					content: "Mira patrols the Old Road.",
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

		const confirmResult = await client.callTool({
			name: "confirm_correct_lore",
			arguments: { token },
		});

		expect(confirmResult.isError).toBeFalsy();
		const confirmContent = confirmResult.content as Array<{
			type: string;
			text: string;
		}>;
		const confirmed = JSON.parse(confirmContent[0]?.text ?? "{}");
		expect(confirmed.supersededChunkIds).toEqual(
			expect.arrayContaining([activeA?.id, activeB?.id]),
		);
		expect(confirmed.supersededChunkIds).toHaveLength(2);
		expect(confirmed.createdChunkIds).toHaveLength(1);

		const supersededRows = await db
			.select({ id: chunks.id, status: chunks.status })
			.from(chunks)
			.where(eq(chunks.id, activeA?.id ?? ""));
		expect(supersededRows[0]?.status).toBe("superseded");

		const newChunkRows = await db
			.select()
			.from(chunks)
			.where(eq(chunks.id, confirmed.createdChunkIds[0]));
		expect(newChunkRows[0]?.content).toContain("Thornwall");
		expect(newChunkRows[0]?.sourceId).toBe(sourceId);
		expect(newChunkRows[0]?.status).toBe("active");
		expect(newChunkRows[0]?.embedding).toHaveLength(1024);
	});

	it("returns a structured not-found error on a second confirm with the same token and does not create a second chunk", async () => {
		const client = await connectedClient(createMockFetch(basisVector(0)));
		const previewResult = await client.callTool({
			name: "correct_lore",
			arguments: {
				campaignId,
				sourceId,
				correctionText: "A correction.",
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
		const secondResult = await client.callTool({
			name: "confirm_correct_lore",
			arguments: { token },
		});

		expect(secondResult.isError).toBe(true);
		const secondContent = secondResult.content as Array<{
			type: string;
			text: string;
		}>;
		const secondPayload = JSON.parse(secondContent[0]?.text ?? "{}");
		expect(secondPayload.error.code).toBe("NOT_FOUND");

		const chunkRows = await db
			.select()
			.from(chunks)
			.where(eq(chunks.campaignId, campaignId));
		expect(chunkRows).toHaveLength(1);
	});

	it("creates a campaign-anchored correction chunk with no target supersession when only entityId is provided", async () => {
		const entity = await entityService.create(db, {
			campaignId,
			name: "Mira Duskwood",
			type: "npc",
		});

		const client = await connectedClient(createMockFetch(basisVector(0)));
		const previewResult = await client.callTool({
			name: "correct_lore",
			arguments: {
				campaignId,
				entityId: entity.id,
				correctionText: "Mira now carries a silver dagger.",
			},
		});
		const previewContent = previewResult.content as Array<{
			type: string;
			text: string;
		}>;
		const { token } = JSON.parse(previewContent[0]?.text ?? "{}");

		const confirmResult = await client.callTool({
			name: "confirm_correct_lore",
			arguments: { token },
		});

		expect(confirmResult.isError).toBeFalsy();
		const confirmContent = confirmResult.content as Array<{
			type: string;
			text: string;
		}>;
		const confirmed = JSON.parse(confirmContent[0]?.text ?? "{}");
		expect(confirmed.supersededChunkIds).toEqual([]);
		expect(confirmed.createdChunkIds).toHaveLength(1);

		const newChunkRows = await db
			.select()
			.from(chunks)
			.where(eq(chunks.id, confirmed.createdChunkIds[0]));
		expect(newChunkRows[0]?.content).toContain("silver dagger");
		expect(newChunkRows[0]?.sourceId).toBeNull();
		expect(newChunkRows[0]?.sessionId).toBeNull();
	});

	it("records a chunk_corrections row atomically with the supersede (T-152)", async () => {
		const [activeA, activeB] = await db
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
					content: "Mira patrols the Old Road.",
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

		const confirmResult = await client.callTool({
			name: "confirm_correct_lore",
			arguments: { token },
		});
		const confirmContent = confirmResult.content as Array<{
			type: string;
			text: string;
		}>;
		const confirmed = JSON.parse(confirmContent[0]?.text ?? "{}");

		const historyRows = await db
			.select()
			.from(chunkCorrections)
			.where(eq(chunkCorrections.campaignId, campaignId));
		expect(historyRows).toHaveLength(1);
		expect(historyRows[0]?.correctionText).toBe(
			"Mira was born in Thornwall, not Ashfall.",
		);
		expect(historyRows[0]?.supersededChunkIds).toEqual(
			expect.arrayContaining([activeA?.id, activeB?.id]),
		);
		expect(historyRows[0]?.createdChunkIds).toEqual(confirmed.createdChunkIds);
	});
});
