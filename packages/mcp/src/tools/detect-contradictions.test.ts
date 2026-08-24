import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { basisVector, deleteCampaignTree } from "@questlog/core/db/test-helpers.js";
import { campaignService } from "@questlog/core/services/campaign.service.js";
import { connectedClient, createMockFetch, db } from "../test-helpers.js";
import { entityService } from "@questlog/core/services/entity.service.js";
import { sessionService } from "@questlog/core/services/session.service.js";
import { sources } from "@questlog/core/db/schema/index.js";

describe("detect_contradictions tool (T-164)", () => {
	// Mirrors continuity.service.test.ts's own mock — the tool layer's
	// contract with the LLM is unchanged by wiring, only who calls it.
	function createContradictionLlmService(
		contradictions: Array<{
			entityId: string;
			newClaimExcerpt: string;
			existingClaimExcerpt: string;
			confidence: number;
		}>,
	): Pick<LlmService, "callClaudeStructured"> {
		return {
			callClaudeStructured: vi.fn().mockResolvedValue({
				data: { contradictions },
				usage: { inputTokens: 0, outputTokens: 0 },
			}),
		};
	}

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

	it("returns a candidate detected in the scoped source (sourceId)", async () => {
		const entity = await entityService.create(db, {
			campaignId,
			name: "Lord Varen",
			type: "npc",
			description: "Lord Varen is deceased, killed at the Siege of Korth.",
		});
		const [source] = await db
			.insert(sources)
			.values({
				campaignId,
				name: "Session 4 recap",
				type: "paste",
				status: "done",
				metadata: {
					extractedText: "Lord Varen greeted the party at the gate.",
				},
			})
			.returning();

		const llmService = createContradictionLlmService([
			{
				entityId: entity.id,
				newClaimExcerpt: "Lord Varen greeted the party at the gate.",
				existingClaimExcerpt:
					"Lord Varen is deceased, killed at the Siege of Korth.",
				confidence: 0.9,
			},
		]);
		const client = await connectedClient(
			createMockFetch(basisVector(0)),
			llmService,
		);

		const result = await client.callTool({
			name: "detect_contradictions",
			arguments: { campaignId, sourceId: source?.id },
		});

		expect(result.isError).toBeFalsy();
		const content = result.content as Array<{ type: string; text: string }>;
		const payload = JSON.parse(content[0]?.text ?? "{}");
		expect(payload.candidates).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ entityId: entity.id, confidence: 0.9 }),
			]),
		);
	});

	it("returns a candidate detected in the scoped session (sessionId)", async () => {
		const entity = await entityService.create(db, {
			campaignId,
			name: "Lord Varen",
			type: "npc",
			description: "Lord Varen is deceased, killed at the Siege of Korth.",
		});
		const session = await sessionService.create(db, {
			campaignId,
			content: "Lord Varen greeted the party at the gate.",
		});

		const llmService = createContradictionLlmService([
			{
				entityId: entity.id,
				newClaimExcerpt: "Lord Varen greeted the party at the gate.",
				existingClaimExcerpt:
					"Lord Varen is deceased, killed at the Siege of Korth.",
				confidence: 0.9,
			},
		]);
		const client = await connectedClient(
			createMockFetch(basisVector(0)),
			llmService,
		);

		const result = await client.callTool({
			name: "detect_contradictions",
			arguments: { campaignId, sessionId: session.id },
		});

		expect(result.isError).toBeFalsy();
		const content = result.content as Array<{ type: string; text: string }>;
		const payload = JSON.parse(content[0]?.text ?? "{}");
		expect(payload.candidates).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ entityId: entity.id, confidence: 0.9 }),
			]),
		);
	});

	it("checks the most recent source and session when no scope is given", async () => {
		const entity = await entityService.create(db, {
			campaignId,
			name: "Lord Varen",
			type: "npc",
			description: "Lord Varen is deceased, killed at the Siege of Korth.",
		});
		await db.insert(sources).values({
			campaignId,
			name: "Older recap",
			type: "paste",
			status: "done",
			metadata: { extractedText: "Nothing notable happened." },
		});
		await db.insert(sources).values({
			campaignId,
			name: "Latest recap",
			type: "paste",
			status: "done",
			metadata: {
				extractedText: "Lord Varen greeted the party at the gate.",
			},
		});

		const llmService = createContradictionLlmService([
			{
				entityId: entity.id,
				newClaimExcerpt: "Lord Varen greeted the party at the gate.",
				existingClaimExcerpt:
					"Lord Varen is deceased, killed at the Siege of Korth.",
				confidence: 0.9,
			},
		]);
		const client = await connectedClient(
			createMockFetch(basisVector(0)),
			llmService,
		);

		const result = await client.callTool({
			name: "detect_contradictions",
			arguments: { campaignId },
		});

		expect(result.isError).toBeFalsy();
		const content = result.content as Array<{ type: string; text: string }>;
		const payload = JSON.parse(content[0]?.text ?? "{}");
		expect(payload.candidates).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ entityId: entity.id, confidence: 0.9 }),
			]),
		);
	});

	it("returns an empty candidates array for a campaign with no contradictions", async () => {
		const llmService = createContradictionLlmService([]);
		const client = await connectedClient(
			createMockFetch(basisVector(0)),
			llmService,
		);

		const result = await client.callTool({
			name: "detect_contradictions",
			arguments: { campaignId },
		});

		expect(result.isError).toBeFalsy();
		const content = result.content as Array<{ type: string; text: string }>;
		const payload = JSON.parse(content[0]?.text ?? "{}");
		expect(payload.candidates).toEqual([]);
	});

	it("rejects/404s on a campaignId the caller doesn't own (T-068 scoping)", async () => {
		const client = await connectedClient(createMockFetch(basisVector(0)));
		const unknownCampaignId = "00000000-0000-0000-0000-000000000000";

		const result = await client.callTool({
			name: "detect_contradictions",
			arguments: { campaignId: unknownCampaignId },
		});

		expect(result.isError).toBe(true);
		const content = result.content as Array<{ type: string; text: string }>;
		const payload = JSON.parse(content[0]?.text ?? "{}");
		expect(payload.error.code).toBe("NOT_FOUND");
	});

	it("rejects/404s on a sourceId owned by a different campaign (T-068 scoping)", async () => {
		const otherCampaign = await campaignService.create(db, {
			name: "Other Campaign",
			theme: "sci-fi",
		});
		const [otherSource] = await db
			.insert(sources)
			.values({
				campaignId: otherCampaign.id,
				name: "Not yours",
				type: "paste",
				status: "done",
				metadata: { extractedText: "Some other campaign's text." },
			})
			.returning();

		const client = await connectedClient(createMockFetch(basisVector(0)));

		const result = await client.callTool({
			name: "detect_contradictions",
			arguments: { campaignId, sourceId: otherSource?.id },
		});

		expect(result.isError).toBe(true);
		const content = result.content as Array<{ type: string; text: string }>;
		const payload = JSON.parse(content[0]?.text ?? "{}");
		expect(payload.error.code).toBe("NOT_FOUND");

		await deleteCampaignTree(db, otherCampaign.id);
	});

	it("rejects/404s on a sessionId owned by a different campaign (T-068 scoping)", async () => {
		const otherCampaign = await campaignService.create(db, {
			name: "Other Campaign",
			theme: "sci-fi",
		});
		const otherSession = await sessionService.create(db, {
			campaignId: otherCampaign.id,
			content: "Some other campaign's session.",
		});

		const client = await connectedClient(createMockFetch(basisVector(0)));

		const result = await client.callTool({
			name: "detect_contradictions",
			arguments: { campaignId, sessionId: otherSession.id },
		});

		expect(result.isError).toBe(true);
		const content = result.content as Array<{ type: string; text: string }>;
		const payload = JSON.parse(content[0]?.text ?? "{}");
		expect(payload.error.code).toBe("NOT_FOUND");

		await deleteCampaignTree(db, otherCampaign.id);
	});
});
