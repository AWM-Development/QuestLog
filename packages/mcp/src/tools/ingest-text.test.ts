import { basisVector, deleteCampaignTree } from "@questlog/core/db/test-helpers.js";
import { campaignService } from "@questlog/core/services/campaign.service.js";
import { sourceService } from "@questlog/core/services/source.service.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { connectedClient, createMockFetch, db, waitForStatus } from "../test-helpers.js";

describe("ingest_text tool", () => {
	// processSource is triggered fire-and-forget (not awaited by the tool
	// handler), same as autoProcessUploads in apps/server/src/server.ts — tests
	// must poll rather than assume completion by the time callTool resolves.
	let campaignId: string;
	let otherCampaignId: string | undefined;

	beforeEach(async () => {
		vi.clearAllMocks();
		otherCampaignId = undefined;

		const campaign = await campaignService.create(db, {
			name: "Ashfall Primer Campaign",
			theme: "fantasy",
		});
		campaignId = campaign.id;
	});

	afterEach(async () => {
		await deleteCampaignTree(db, campaignId);
		if (otherCampaignId) {
			await deleteCampaignTree(db, otherCampaignId);
		}
	});

	it("creates a pending source immediately and reaches done with a queryable chunk", async () => {
		const client = await connectedClient(createMockFetch(basisVector(0)));

		const result = await client.callTool({
			name: "ingest_text",
			arguments: {
				campaignId,
				title: "Ashfall Primer",
				content: "Mira Duskwood patrols the Old Road near Ashfall Peak.",
			},
		});

		expect(result.isError).toBeFalsy();
		const content = result.content as Array<{ type: string; text: string }>;
		const payload = JSON.parse(content[0]?.text ?? "{}");
		expect(payload.source.id).toBeDefined();
		expect(payload.source.status).toBe("pending");

		const finalStatus = await waitForStatus(payload.source.id, "done");
		expect(finalStatus).toBe("done");

		const queryResult = await client.callTool({
			name: "query_lore",
			arguments: { campaignId, query: "Who patrols the road?" },
		});
		expect(queryResult.isError).toBeFalsy();
		const queryContent = queryResult.content as Array<{
			type: string;
			text: string;
		}>;
		const queryPayload = JSON.parse(queryContent[0]?.text ?? "{}");
		expect(queryPayload.citations).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ sourceId: payload.source.id }),
			]),
		);
	});

	it("chains two ingest_text calls with the same sourceId into one queryable source (T-065)", async () => {
		const client = await connectedClient(createMockFetch(basisVector(0)));

		const firstResult = await client.callTool({
			name: "ingest_text",
			arguments: {
				campaignId,
				title: "Ashfall Primer",
				content: "Mira Duskwood patrols the Old Road near Ashfall Peak. ",
				final: false,
			},
		});
		expect(firstResult.isError).toBeFalsy();
		const firstContent = firstResult.content as Array<{
			type: string;
			text: string;
		}>;
		const { source } = JSON.parse(firstContent[0]?.text ?? "{}");
		expect(source.status).toBe("pending");

		// Processing must not have started after a non-final chunk.
		const stillPending = await sourceService.getByIdUnscoped(db, source.id);
		expect(stillPending.status).toBe("pending");

		const secondResult = await client.callTool({
			name: "ingest_text",
			arguments: {
				campaignId,
				title: "Ashfall Primer",
				content: "The party rests at the Ashfall inn.",
				sourceId: source.id,
				final: true,
			},
		});
		expect(secondResult.isError).toBeFalsy();
		const secondContent = secondResult.content as Array<{
			type: string;
			text: string;
		}>;
		const secondPayload = JSON.parse(secondContent[0]?.text ?? "{}");
		expect(secondPayload.source.id).toBe(source.id);

		const finalStatus = await waitForStatus(source.id, "done");
		expect(finalStatus).toBe("done");

		const roadQuery = await client.callTool({
			name: "query_lore",
			arguments: { campaignId, query: "Who patrols the road?" },
		});
		const roadPayload = JSON.parse(
			(roadQuery.content as Array<{ type: string; text: string }>)[0]?.text ??
				"{}",
		);
		expect(roadPayload.citations).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ sourceId: source.id }),
			]),
		);

		const innQuery = await client.callTool({
			name: "query_lore",
			arguments: { campaignId, query: "Where does the party rest?" },
		});
		const innPayload = JSON.parse(
			(innQuery.content as Array<{ type: string; text: string }>)[0]?.text ??
				"{}",
		);
		expect(innPayload.citations).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ sourceId: source.id }),
			]),
		);
	});

	it("throws when ingest_text is called with a sourceId pointing at a non-pending source", async () => {
		const client = await connectedClient(createMockFetch(basisVector(0)));

		const ingestResult = await client.callTool({
			name: "ingest_text",
			arguments: {
				campaignId,
				title: "Ashfall Primer",
				content: "Some content.",
			},
		});
		const { source } = JSON.parse(
			(ingestResult.content as Array<{ type: string; text: string }>)[0]
				?.text ?? "{}",
		);

		await waitForStatus(source.id, "done");

		const secondResult = await client.callTool({
			name: "ingest_text",
			arguments: {
				campaignId,
				title: "Ashfall Primer",
				content: "More content.",
				sourceId: source.id,
			},
		});

		expect(secondResult.isError).toBe(true);
		const secondContent = secondResult.content as Array<{
			type: string;
			text: string;
		}>;
		const { error } = JSON.parse(secondContent[0]?.text ?? "{}");
		expect(error).toEqual(
			expect.objectContaining({ code: "VALIDATION_ERROR" }),
		);
	});

	it("returns a structured not-found error when ingest_text's sourceId belongs to a different campaign", async () => {
		const otherCampaign = await campaignService.create(db, {
			name: "Other Campaign",
			theme: "fantasy",
		});
		otherCampaignId = otherCampaign.id;

		const client = await connectedClient(createMockFetch(basisVector(0)));
		const ingestResult = await client.callTool({
			name: "ingest_text",
			arguments: {
				campaignId,
				title: "Ashfall Primer",
				content: "Some content.",
				final: false,
			},
		});
		const { source } = JSON.parse(
			(ingestResult.content as Array<{ type: string; text: string }>)[0]
				?.text ?? "{}",
		);

		const result = await client.callTool({
			name: "ingest_text",
			arguments: {
				campaignId: otherCampaign.id,
				title: "Ashfall Primer",
				content: "More content.",
				sourceId: source.id,
			},
		});

		expect(result.isError).toBe(true);
		const resultContent = result.content as Array<{
			type: string;
			text: string;
		}>;
		const { error } = JSON.parse(resultContent[0]?.text ?? "{}");
		expect(error).toEqual(expect.objectContaining({ code: "NOT_FOUND" }));
	});

	it("creates a new campaign and a source tied to it when called with newCampaign instead of campaignId (T-067)", async () => {
		const client = await connectedClient(createMockFetch(basisVector(0)));

		const result = await client.callTool({
			name: "ingest_text",
			arguments: {
				newCampaign: { name: "Brand New Campaign", theme: "fantasy" },
				title: "Ashfall Primer",
				content: "Mira Duskwood patrols the Old Road near Ashfall Peak.",
			},
		});

		expect(result.isError).toBeFalsy();
		const content = result.content as Array<{ type: string; text: string }>;
		const payload = JSON.parse(content[0]?.text ?? "{}");
		expect(payload.campaign?.id).toBeDefined();
		expect(payload.source.id).toBeDefined();
		expect(payload.source.status).toBe("pending");
		otherCampaignId = payload.campaign.id;

		const listResult = await client.callTool({
			name: "list_campaigns",
			arguments: {},
		});
		const listContent = listResult.content as Array<{
			type: string;
			text: string;
		}>;
		const listed = JSON.parse(listContent[0]?.text ?? "{}");
		expect(listed.campaigns).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ id: payload.campaign.id }),
			]),
		);

		const statusResult = await client.callTool({
			name: "get_source_status",
			arguments: {
				campaignId: payload.campaign.id,
				sourceId: payload.source.id,
			},
		});
		expect(statusResult.isError).toBeFalsy();
	});

	it("rejects ingest_text called with both campaignId and newCampaign, or neither, as a structured error (T-067)", async () => {
		const client = await connectedClient(createMockFetch(basisVector(0)));

		const bothResult = await client.callTool({
			name: "ingest_text",
			arguments: {
				campaignId,
				newCampaign: { name: "Brand New Campaign", theme: "fantasy" },
				title: "Ashfall Primer",
				content: "Some content.",
			},
		});
		expect(bothResult.isError).toBe(true);
		const bothContent = bothResult.content as Array<{
			type: string;
			text: string;
		}>;
		expect(bothContent[0]?.text).toMatch(
			/Exactly one of campaignId or newCampaign/,
		);

		const neitherResult = await client.callTool({
			name: "ingest_text",
			arguments: { title: "Ashfall Primer", content: "Some content." },
		});
		expect(neitherResult.isError).toBe(true);
		const neitherContent = neitherResult.content as Array<{
			type: string;
			text: string;
		}>;
		expect(neitherContent[0]?.text).toMatch(
			/Exactly one of campaignId or newCampaign/,
		);
	});

});
