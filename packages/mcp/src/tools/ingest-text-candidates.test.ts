import { entities, writeRequests } from "@questlog/core/db/schema/index.js";
import {
	basisVector,
	deleteCampaignTree,
} from "@questlog/core/db/test-helpers.js";
import { campaignService } from "@questlog/core/services/campaign.service.js";
import { entityService } from "@questlog/core/services/entity.service.js";
import type { LlmService } from "@questlog/core/services/llm.service.js";
import { sourceService } from "@questlog/core/services/source.service.js";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	connectedClient,
	createMockFetch,
	db,
	waitForStatus,
} from "../test-helpers.js";

/**
 * T-103 split: entity-candidate and contradiction-candidate tests for
 * ingest_text were pulled into their own file (rather than staying under
 * ingest-text.test.ts) purely for size — this describe block plus its
 * setup was pushing that file well past the ticket's ~400-line ceiling.
 * There's no dedicated "candidate-detection" production tool file for this
 * to mirror 1:1; see Docs/IMPLEMENTATION_NOTES.md § T-103.
 */
describe("ingest_text tool — entity/contradiction candidates (T-079/T-159/T-164)", () => {
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

	it("stages entityCandidates as a write_requests preview when content contains a detectable new entity (T-079)", async () => {
		const client = await connectedClient(createMockFetch(basisVector(0)));

		const result = await client.callTool({
			name: "ingest_text",
			arguments: {
				campaignId,
				title: "Ashfall Primer",
				content: "The party met Vespera Nightveil at the gates.",
			},
		});

		expect(result.isError).toBeFalsy();
		const content = result.content as Array<{ type: string; text: string }>;
		const payload = JSON.parse(content[0]?.text ?? "{}");
		expect(payload.source.id).toBeDefined();
		expect(payload.entityCandidates.token).toBeTruthy();
		expect(payload.entityCandidates.candidates).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					name: "Vespera Nightveil",
					entityType: "npc",
				}),
			]),
		);

		const entityRows = await db
			.select()
			.from(entities)
			.where(eq(entities.campaignId, campaignId));
		expect(entityRows).toHaveLength(0);

		// See the next test for why this await is needed before cleanup.
		await waitForStatus(payload.source.id, "done");
	});

	it("returns entityCandidates: null and stages no write_requests row when content has no detectable candidates (T-079)", async () => {
		const client = await connectedClient(createMockFetch(basisVector(0)));

		const result = await client.callTool({
			name: "ingest_text",
			arguments: {
				campaignId,
				title: "Ashfall Primer",
				content: "the party rests quietly.",
			},
		});

		expect(result.isError).toBeFalsy();
		const content = result.content as Array<{ type: string; text: string }>;
		const payload = JSON.parse(content[0]?.text ?? "{}");
		expect(payload.entityCandidates).toBeNull();

		const pendingRequests = await db
			.select()
			.from(writeRequests)
			.where(eq(writeRequests.campaignId, campaignId));
		expect(pendingRequests).toHaveLength(0);

		// Let fire-and-forget embedding settle before afterEach's
		// deleteCampaignTree runs, or the source delete can race chunk inserts.
		await waitForStatus(payload.source.id, "done");
	});

	it("still returns the source id when entity-candidate detection throws (T-159)", async () => {
		const failingLlmService: Pick<LlmService, "callClaudeStructured"> = {
			callClaudeStructured: vi
				.fn()
				.mockRejectedValue(new Error("simulated LLM failure")),
		};
		const client = await connectedClient(
			createMockFetch(basisVector(0)),
			failingLlmService,
		);

		const result = await client.callTool({
			name: "ingest_text",
			arguments: {
				campaignId,
				title: "Ashfall Primer",
				content: "The party met Vespera Nightveil at the gates.",
			},
		});

		expect(result.isError).toBeFalsy();
		const content = result.content as Array<{ type: string; text: string }>;
		const payload = JSON.parse(content[0]?.text ?? "{}");
		expect(payload.source.id).toBeDefined();
		expect(payload.source.status).toBeDefined();
		expect(payload.entityCandidates).toBeNull();

		const persisted = await sourceService.getByIdUnscoped(
			db,
			payload.source.id,
		);
		expect(persisted).toBeDefined();

		await waitForStatus(payload.source.id, "done");
	});

	it("includes a non-empty contradictionCandidates array when the ingested text conflicts with existing entity lore (T-164)", async () => {
		const entity = await entityService.create(db, {
			campaignId,
			name: "Lord Varen",
			type: "npc",
			description: "Lord Varen is deceased, killed at the Siege of Korth.",
		});
		const contradictionLlmService: Pick<LlmService, "callClaudeStructured"> = {
			callClaudeStructured: vi
				.fn()
				.mockImplementation(async ({ schemaName }) => {
					if (schemaName === "report_contradictions") {
						return {
							data: {
								contradictions: [
									{
										entityId: entity.id,
										newClaimExcerpt:
											"Lord Varen greeted the party at the gate.",
										existingClaimExcerpt:
											"Lord Varen is deceased, killed at the Siege of Korth.",
										confidence: 0.9,
									},
								],
							},
							usage: { inputTokens: 0, outputTokens: 0 },
						};
					}
					return {
						data: { candidates: [] },
						usage: { inputTokens: 0, outputTokens: 0 },
					};
				}),
		};
		const client = await connectedClient(
			createMockFetch(basisVector(0)),
			contradictionLlmService,
		);

		const result = await client.callTool({
			name: "ingest_text",
			arguments: {
				campaignId,
				title: "Ashfall Primer",
				content: "Lord Varen greeted the party at the gate.",
			},
		});

		expect(result.isError).toBeFalsy();
		const content = result.content as Array<{ type: string; text: string }>;
		const payload = JSON.parse(content[0]?.text ?? "{}");
		expect(payload.contradictionCandidates).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ entityId: entity.id, confidence: 0.9 }),
			]),
		);

		await waitForStatus(payload.source.id, "done");
	});

	it("returns an empty contradictionCandidates array when nothing conflicts", async () => {
		const client = await connectedClient(createMockFetch(basisVector(0)));

		const result = await client.callTool({
			name: "ingest_text",
			arguments: {
				campaignId,
				title: "Ashfall Primer",
				content: "The party rests at the Ashfall inn.",
			},
		});

		expect(result.isError).toBeFalsy();
		const content = result.content as Array<{ type: string; text: string }>;
		const payload = JSON.parse(content[0]?.text ?? "{}");
		expect(payload.contradictionCandidates).toEqual([]);

		await waitForStatus(payload.source.id, "done");
	});
});
