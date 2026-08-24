import { basisVector, deleteCampaignTree } from "@questlog/core/db/test-helpers.js";
import { campaignService } from "@questlog/core/services/campaign.service.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { connectedClient, createFailingFetch, createMockFetch, db, waitForStatus } from "../test-helpers.js";

describe("get_source_status tool", () => {
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

	it("get_source_status reports pending then done for the same source", async () => {
		const client = await connectedClient(createMockFetch(basisVector(0)));

		const ingestResult = await client.callTool({
			name: "ingest_text",
			arguments: {
				campaignId,
				title: "Ashfall Primer",
				content: "The party rests at the Ashfall inn.",
			},
		});
		const ingestContent = ingestResult.content as Array<{
			type: string;
			text: string;
		}>;
		const { source } = JSON.parse(ingestContent[0]?.text ?? "{}");

		const statusResult = await client.callTool({
			name: "get_source_status",
			arguments: { campaignId, sourceId: source.id },
		});
		expect(statusResult.isError).toBeFalsy();
		const statusContent = statusResult.content as Array<{
			type: string;
			text: string;
		}>;
		// T-079 made ingest_text run detectCandidates synchronously before
		// returning, giving the fire-and-forget embed pipeline a small head
		// start — status may already have advanced past "pending" by the time
		// this call lands, so assert "in flight", not the exact first stage.
		expect(JSON.parse(statusContent[0]?.text ?? "{}").status).not.toBe("done");

		await waitForStatus(source.id, "done");

		const doneResult = await client.callTool({
			name: "get_source_status",
			arguments: { campaignId, sourceId: source.id },
		});
		const doneContent = doneResult.content as Array<{
			type: string;
			text: string;
		}>;
		expect(JSON.parse(doneContent[0]?.text ?? "{}").status).toBe("done");
	});

	it("get_source_status reports error with an errorReason when embedding fails", async () => {
		const client = await connectedClient(createFailingFetch());

		const ingestResult = await client.callTool({
			name: "ingest_text",
			arguments: {
				campaignId,
				title: "Broken Source",
				content: "This will fail to embed.",
			},
		});
		const ingestContent = ingestResult.content as Array<{
			type: string;
			text: string;
		}>;
		const { source } = JSON.parse(ingestContent[0]?.text ?? "{}");

		await waitForStatus(source.id, "done");

		const statusResult = await client.callTool({
			name: "get_source_status",
			arguments: { campaignId, sourceId: source.id },
		});
		const statusPayload = JSON.parse(
			(statusResult.content as Array<{ type: string; text: string }>)[0]
				?.text ?? "{}",
		);
		expect(statusPayload.status).toBe("error");
		expect(statusPayload.errorReason).toBeTruthy();
	});

	it("get_source_status returns a structured not-found error for a source outside the given campaign", async () => {
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
			},
		});
		const ingestContent = ingestResult.content as Array<{
			type: string;
			text: string;
		}>;
		const { source } = JSON.parse(ingestContent[0]?.text ?? "{}");

		const result = await client.callTool({
			name: "get_source_status",
			arguments: { campaignId: otherCampaign.id, sourceId: source.id },
		});

		expect(result.isError).toBe(true);
		const content = result.content as Array<{ type: string; text: string }>;
		const payload = JSON.parse(content[0]?.text ?? "{}");
		expect(payload.error.code).toBe("NOT_FOUND");
	});

});
