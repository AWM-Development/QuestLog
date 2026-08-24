import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	chunks,
	entities,
	sessionEntities,
	sessions,
} from "@questlog/core/db/schema/index.js";
import { basisVector, deleteCampaignTree } from "@questlog/core/db/test-helpers.js";
import { campaignService } from "@questlog/core/services/campaign.service.js";
import { connectedClient, createMockFetch, db } from "../test-helpers.js";
import { entityService } from "@questlog/core/services/entity.service.js";
import { eq } from "drizzle-orm";
import { writeRequestService } from "@questlog/core/services/write-request.service.js";

describe("log_session + confirm_log_session tools", () => {
	// confirm_log_session opens its own db.transaction() (via
	// writeRequestService.confirm), which does not compose with a raw
	// BEGIN/ROLLBACK wrapper on the same connection (.claude/rules/backend.md
	// "Test DB pattern") — use explicit FK-safe cleanup instead.
	let campaignId: string;

	beforeEach(async () => {
		vi.clearAllMocks();

		const campaign = await campaignService.create(db, {
			name: "Ashfall Primer Campaign",
			theme: "fantasy",
		});
		campaignId = campaign.id;
	});

	afterEach(async () => {
		await deleteCampaignTree(db, campaignId);
	});

	it("previews a session with a confirmed entity link and writes nothing yet", async () => {
		const entity = await entityService.create(db, {
			campaignId,
			name: "Mira Duskwood",
			type: "npc",
		});

		const client = await connectedClient(createMockFetch(basisVector(0)));
		const result = await client.callTool({
			name: "log_session",
			arguments: {
				campaignId,
				content: "Mira Duskwood met the party at the gates.",
			},
		});

		expect(result.isError).toBeFalsy();
		const content = result.content as Array<{ type: string; text: string }>;
		const payload = JSON.parse(content[0]?.text ?? "{}");

		expect(payload.token).toBeDefined();
		expect(payload.preview.entityLinks.confirmed).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ entityId: entity.id }),
			]),
		);

		const sessionRows = await db
			.select()
			.from(sessions)
			.where(eq(sessions.campaignId, campaignId));
		expect(sessionRows).toHaveLength(0);
	});

	it("creates the session and links the confirmed entity on confirm", async () => {
		const entity = await entityService.create(db, {
			campaignId,
			name: "Mira Duskwood",
			type: "npc",
		});

		const client = await connectedClient(createMockFetch(basisVector(0)));
		const previewResult = await client.callTool({
			name: "log_session",
			arguments: {
				campaignId,
				content: "Mira Duskwood met the party at the gates.",
				title: "Session One",
			},
		});
		const previewContent = previewResult.content as Array<{
			type: string;
			text: string;
		}>;
		const { token } = JSON.parse(previewContent[0]?.text ?? "{}");

		const confirmResult = await client.callTool({
			name: "confirm_log_session",
			arguments: { token },
		});

		expect(confirmResult.isError).toBeFalsy();
		const confirmContent = confirmResult.content as Array<{
			type: string;
			text: string;
		}>;
		const confirmed = JSON.parse(confirmContent[0]?.text ?? "{}");
		expect(confirmed.session.title).toBe("Session One");

		const sessionRows = await db
			.select()
			.from(sessions)
			.where(eq(sessions.campaignId, campaignId));
		expect(sessionRows).toHaveLength(1);
		expect(sessionRows[0]?.content).toBe(
			"Mira Duskwood met the party at the gates.",
		);

		const linkRows = await db
			.select()
			.from(sessionEntities)
			.where(eq(sessionEntities.sessionId, sessionRows[0]?.id ?? ""));
		expect(linkRows).toHaveLength(1);
		expect(linkRows[0]?.entityId).toBe(entity.id);
	});

	it("returns a structured not-found error on a second confirm with the same token and does not create a second session", async () => {
		await entityService.create(db, {
			campaignId,
			name: "Mira Duskwood",
			type: "npc",
		});

		const client = await connectedClient(createMockFetch(basisVector(0)));
		const previewResult = await client.callTool({
			name: "log_session",
			arguments: {
				campaignId,
				content: "Mira Duskwood met the party at the gates.",
			},
		});
		const previewContent = previewResult.content as Array<{
			type: string;
			text: string;
		}>;
		const { token } = JSON.parse(previewContent[0]?.text ?? "{}");

		await client.callTool({
			name: "confirm_log_session",
			arguments: { token },
		});
		const secondResult = await client.callTool({
			name: "confirm_log_session",
			arguments: { token },
		});

		expect(secondResult.isError).toBe(true);
		const secondContent = secondResult.content as Array<{
			type: string;
			text: string;
		}>;
		const secondPayload = JSON.parse(secondContent[0]?.text ?? "{}");
		expect(secondPayload.error.code).toBe("NOT_FOUND");

		const sessionRows = await db
			.select()
			.from(sessions)
			.where(eq(sessions.campaignId, campaignId));
		expect(sessionRows).toHaveLength(1);
	});

	it("previews an ambiguous entity mention and does not link it on confirm", async () => {
		await entityService.create(db, {
			campaignId,
			name: "Aldric",
			type: "npc",
		});
		await entityService.create(db, {
			campaignId,
			name: "Aldric",
			type: "location",
		});

		const client = await connectedClient(createMockFetch(basisVector(0)));
		const previewResult = await client.callTool({
			name: "log_session",
			arguments: {
				campaignId,
				content: "Aldric was mentioned at the tavern.",
			},
		});

		expect(previewResult.isError).toBeFalsy();
		const previewContent = previewResult.content as Array<{
			type: string;
			text: string;
		}>;
		const { token, preview } = JSON.parse(previewContent[0]?.text ?? "{}");

		expect(preview.entityLinks.confirmed).toHaveLength(0);
		expect(preview.entityLinks.ambiguous).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ entityName: "Aldric" }),
			]),
		);

		await client.callTool({
			name: "confirm_log_session",
			arguments: { token },
		});

		const sessionRows = await db
			.select()
			.from(sessions)
			.where(eq(sessions.campaignId, campaignId));
		expect(sessionRows).toHaveLength(1);

		const linkRows = await db
			.select()
			.from(sessionEntities)
			.where(eq(sessionEntities.sessionId, sessionRows[0]?.id ?? ""));
		expect(linkRows).toHaveLength(0);
	});

	it("includes chunkPreview and entityConsolidation in the preview for a confirmed entity mention", async () => {
		const entity = await entityService.create(db, {
			campaignId,
			name: "Mira Duskwood",
			type: "npc",
			description: "A ranger who knows the Old Road.",
		});

		const client = await connectedClient(createMockFetch(basisVector(0)));
		const result = await client.callTool({
			name: "log_session",
			arguments: {
				campaignId,
				content: "Mira Duskwood met the party at the gates.",
			},
		});

		expect(result.isError).toBeFalsy();
		const content = result.content as Array<{ type: string; text: string }>;
		const { preview } = JSON.parse(content[0]?.text ?? "{}");

		expect(preview.chunkPreview.count).toBe(1);
		expect(preview.chunkPreview.firstChunkExcerpt).toContain(
			"Mira Duskwood met the party at the gates.",
		);
		expect(preview.entityConsolidation).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					entityId: entity.id,
					appendedNote: "Mira Duskwood met the party at the gates.",
				}),
			]),
		);
	});

	it("chunks + embeds the session content and appends the consolidation note on confirm", async () => {
		const entity = await entityService.create(db, {
			campaignId,
			name: "Mira Duskwood",
			type: "npc",
			description: "A ranger who knows the Old Road.",
		});

		const client = await connectedClient(createMockFetch(basisVector(0)));
		const previewResult = await client.callTool({
			name: "log_session",
			arguments: {
				campaignId,
				content: "Mira Duskwood met the party at the gates.",
			},
		});
		const previewContent = previewResult.content as Array<{
			type: string;
			text: string;
		}>;
		const { token } = JSON.parse(previewContent[0]?.text ?? "{}");

		const confirmResult = await client.callTool({
			name: "confirm_log_session",
			arguments: { token },
		});
		expect(confirmResult.isError).toBeFalsy();

		const sessionRows = await db
			.select()
			.from(sessions)
			.where(eq(sessions.campaignId, campaignId));
		const sessionId = sessionRows[0]?.id ?? "";

		const chunkRows = await db
			.select()
			.from(chunks)
			.where(eq(chunks.sessionId, sessionId));
		expect(chunkRows).toHaveLength(1);
		expect(chunkRows[0]?.content).toContain(
			"Mira Duskwood met the party at the gates.",
		);
		expect(chunkRows[0]?.embedding).toHaveLength(1024);

		// Retrievable via query_lore against a phrase unique to this session.
		const queryResult = await client.callTool({
			name: "query_lore",
			arguments: { campaignId, query: "Who met the party at the gates?" },
		});
		expect(queryResult.isError).toBeFalsy();
		const queryContent = queryResult.content as Array<{
			type: string;
			text: string;
		}>;
		const queryPayload = JSON.parse(queryContent[0]?.text ?? "{}");
		expect(queryPayload.citations).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ chunkId: chunkRows[0]?.id }),
			]),
		);

		const [updatedEntity] = await db
			.select()
			.from(entities)
			.where(eq(entities.id, entity.id));
		expect(updatedEntity?.description).toBe(
			"A ranger who knows the Old Road.\n\nMira Duskwood met the party at the gates.",
		);
	});

	it("leaves the chunks table and entity description unchanged when a preview is never confirmed", async () => {
		const entity = await entityService.create(db, {
			campaignId,
			name: "Mira Duskwood",
			type: "npc",
			description: "A ranger who knows the Old Road.",
		});

		const client = await connectedClient(createMockFetch(basisVector(0)));
		await client.callTool({
			name: "log_session",
			arguments: {
				campaignId,
				content: "Mira Duskwood met the party at the gates.",
			},
		});

		const chunkRows = await db
			.select()
			.from(chunks)
			.where(eq(chunks.campaignId, campaignId));
		expect(chunkRows).toHaveLength(0);

		const [unchangedEntity] = await db
			.select()
			.from(entities)
			.where(eq(entities.id, entity.id));
		expect(unchangedEntity?.description).toBe(
			"A ranger who knows the Old Road.",
		);
	});
});
