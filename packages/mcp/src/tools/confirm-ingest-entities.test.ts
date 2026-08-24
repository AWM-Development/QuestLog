import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { entities } from "@questlog/core/db/schema/index.js";
import { basisVector, deleteCampaignTree } from "@questlog/core/db/test-helpers.js";
import { campaignService } from "@questlog/core/services/campaign.service.js";
import type { LlmService } from "@questlog/core/services/llm.service.js";
import { writeRequestService } from "@questlog/core/services/write-request.service.js";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { connectedClient, createMockFetch, db, waitForStatus } from "../test-helpers.js";

/** Mock structured-extraction client returning a fixed candidate list, for tests exercising a specific staged shape (e.g. an "unclassified" candidate) rather than the fixture heuristic's derived output. */
function createMockLlmService(
	candidates: Array<{
		name: string;
		entityType: string;
		description: string;
		startIndex: number;
		endIndex: number;
	}>,
): Pick<LlmService, "callClaudeStructured"> {
	return {
		callClaudeStructured: vi.fn().mockResolvedValue({
			data: { candidates },
			usage: { inputTokens: 0, outputTokens: 0 },
		}),
	};
}

describe("confirm_ingest_entities tool (T-080)", () => {
	// writeRequestService.confirm opens its own db.transaction(), which does
	// not compose with a raw BEGIN/ROLLBACK wrapper on the same connection
	// (.claude/rules/backend.md "Test DB pattern") — use explicit FK-safe
	// cleanup instead.
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

	async function stageCandidates(client: Client, content: string) {
		const result = await client.callTool({
			name: "ingest_text",
			arguments: { campaignId, title: "Ashfall Primer", content },
		});
		const payload = JSON.parse(
			(result.content as Array<{ type: string; text: string }>)[0]?.text ??
				"{}",
		);
		await waitForStatus(payload.source.id, "done");
		return {
			sourceId: payload.source.id as string,
			...(payload.entityCandidates as {
				token: string;
				candidates: Array<{ name: string; entityType: string }>;
			}),
		};
	}

	it("creates one entity per staged candidate when confirming the full list", async () => {
		const client = await connectedClient(createMockFetch(basisVector(0)));
		const { token, candidates, sourceId } = await stageCandidates(
			client,
			"The party met Vespera Nightveil at dawn. They traveled to Castle Ravenloft by nightfall.",
		);
		expect(candidates.length).toBe(2);

		const confirmResult = await client.callTool({
			name: "confirm_ingest_entities",
			arguments: { token },
		});

		expect(confirmResult.isError).toBeFalsy();
		const confirmContent = confirmResult.content as Array<{
			type: string;
			text: string;
		}>;
		const { entityIds } = JSON.parse(confirmContent[0]?.text ?? "{}");
		expect(entityIds).toHaveLength(2);

		const entityRows = await db
			.select()
			.from(entities)
			.where(eq(entities.campaignId, campaignId));
		expect(entityRows).toHaveLength(2);
		expect(entityRows.map((e) => e.name).sort()).toEqual(
			["Castle Ravenloft", "Vespera Nightveil"].sort(),
		);
		for (const row of entityRows) {
			expect(entityIds).toContain(row.id);
			expect(row.sourceId).toBe(sourceId);
			expect(row.attributes).toEqual({ extractedFrom: sourceId });
		}
	});

	it("creates only the selected subset of candidates when candidateIndices is given", async () => {
		const client = await connectedClient(createMockFetch(basisVector(0)));
		const { token, candidates } = await stageCandidates(
			client,
			"The party met Vespera Nightveil at dawn. They traveled to Castle Ravenloft by nightfall.",
		);
		const vesperaIndex = candidates.findIndex(
			(c) => c.name === "Vespera Nightveil",
		);
		expect(vesperaIndex).toBeGreaterThanOrEqual(0);

		const confirmResult = await client.callTool({
			name: "confirm_ingest_entities",
			arguments: { token, candidateIndices: [vesperaIndex] },
		});

		expect(confirmResult.isError).toBeFalsy();
		const confirmContent = confirmResult.content as Array<{
			type: string;
			text: string;
		}>;
		const { entityIds } = JSON.parse(confirmContent[0]?.text ?? "{}");
		expect(entityIds).toHaveLength(1);

		const entityRows = await db
			.select()
			.from(entities)
			.where(eq(entities.campaignId, campaignId));
		expect(entityRows).toHaveLength(1);
		expect(entityRows[0]?.name).toBe("Vespera Nightveil");
	});

	it("returns a structured not-found error on a second confirm with the same token and creates no additional entities", async () => {
		const client = await connectedClient(createMockFetch(basisVector(0)));
		const { token } = await stageCandidates(
			client,
			"The party met Vespera Nightveil at the gates.",
		);

		await client.callTool({
			name: "confirm_ingest_entities",
			arguments: { token },
		});
		const secondResult = await client.callTool({
			name: "confirm_ingest_entities",
			arguments: { token },
		});

		expect(secondResult.isError).toBe(true);
		const secondContent = secondResult.content as Array<{
			type: string;
			text: string;
		}>;
		const { error } = JSON.parse(secondContent[0]?.text ?? "{}");
		expect(error).toEqual(expect.objectContaining({ code: "NOT_FOUND" }));

		const entityRows = await db
			.select()
			.from(entities)
			.where(eq(entities.campaignId, campaignId));
		expect(entityRows).toHaveLength(1);
	});

	it("rejects an unclassified candidate with no override but still creates the rest of the batch (G-021 Resolution §2)", async () => {
		const content = "A stranger passed through the gates.";
		const client = await connectedClient(
			createMockFetch(basisVector(0)),
			createMockLlmService([
				{
					name: "A stranger",
					entityType: "unclassified",
					description: "An unidentifiable figure.",
					startIndex: 0,
					endIndex: 11,
				},
				{
					name: "Vespera Nightveil",
					entityType: "npc",
					description: "Mentioned in passing.",
					startIndex: content.length,
					endIndex: content.length,
				},
			]),
		);
		const { token, sourceId } = await stageCandidates(client, content);

		const confirmResult = await client.callTool({
			name: "confirm_ingest_entities",
			arguments: { token },
		});

		expect(confirmResult.isError).toBeFalsy();
		const confirmContent = confirmResult.content as Array<{
			type: string;
			text: string;
		}>;
		const { entityIds, rejected } = JSON.parse(confirmContent[0]?.text ?? "{}");
		expect(entityIds).toHaveLength(1);
		expect(rejected).toEqual([
			expect.objectContaining({
				index: 0,
				reason: expect.stringContaining("entityType override"),
			}),
		]);

		const entityRows = await db
			.select()
			.from(entities)
			.where(eq(entities.campaignId, campaignId));
		expect(entityRows).toHaveLength(1);
		expect(entityRows[0]?.name).toBe("Vespera Nightveil");
		expect(sourceId).toBeTruthy();
	});

	it("creates an unclassified candidate with the entityType supplied via entityTypeOverrides", async () => {
		const content = "A stranger passed through the gates.";
		const client = await connectedClient(
			createMockFetch(basisVector(0)),
			createMockLlmService([
				{
					name: "A stranger",
					entityType: "unclassified",
					description: "An unidentifiable figure.",
					startIndex: 0,
					endIndex: 11,
				},
			]),
		);
		const { token } = await stageCandidates(client, content);

		const confirmResult = await client.callTool({
			name: "confirm_ingest_entities",
			arguments: { token, entityTypeOverrides: { "0": "npc" } },
		});

		expect(confirmResult.isError).toBeFalsy();
		const confirmContent = confirmResult.content as Array<{
			type: string;
			text: string;
		}>;
		const { entityIds, rejected } = JSON.parse(confirmContent[0]?.text ?? "{}");
		expect(entityIds).toHaveLength(1);
		expect(rejected).toEqual([]);

		const entityRows = await db
			.select()
			.from(entities)
			.where(eq(entities.campaignId, campaignId));
		expect(entityRows).toHaveLength(1);
		expect(entityRows[0]?.name).toBe("A stranger");
		expect(entityRows[0]?.type).toBe("npc");
	});
});
