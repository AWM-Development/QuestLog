import { afterEach, describe, expect, it } from "vitest";
import { basisVector, deleteCampaignTree } from "@questlog/core/db/test-helpers.js";
import { campaignService } from "@questlog/core/services/campaign.service.js";
import { campaigns } from "@questlog/core/db/schema/index.js";
import { connectedClient, createMockFetch, db } from "../test-helpers.js";
import { eq } from "drizzle-orm";

describe("list_campaigns tool", () => {
	let campaignId: string;

	afterEach(async () => {
		if (campaignId) {
			await db.delete(campaigns).where(eq(campaigns.id, campaignId));
		}
	});

	it("returns the seeded campaign with the specified fields", async () => {
		const campaign = await campaignService.create(db, {
			name: "Ashfall Primer Campaign",
			theme: "fantasy",
			description: "A frontier town beset by ash storms.",
			gameSystem: "D&D 5e",
		});
		campaignId = campaign.id;

		const client = await connectedClient(createMockFetch(basisVector(0)));
		const result = await client.callTool({
			name: "list_campaigns",
			arguments: {},
		});

		expect(result.isError).toBeFalsy();
		const content = result.content as Array<{ type: string; text: string }>;
		const payload = JSON.parse(content[0]?.text ?? "{}");
		const found = payload.campaigns.find(
			(c: { id: string }) => c.id === campaignId,
		);
		expect(found).toMatchObject({
			id: campaignId,
			name: "Ashfall Primer Campaign",
			description: "A frontier town beset by ash storms.",
			theme: "fantasy",
			gameSystem: "D&D 5e",
			status: "active",
		});
	});

	it("returns a well-formed empty list from a genuinely empty campaigns table", async () => {
		// T-028 relocated this suite into apps/server, sharing questlog_test with
		// every other apps/server test file — safe because every one of those
		// wraps its campaign rows in BEGIN/ROLLBACK or deleteCampaignTree
		// (.claude/rules/backend.md "Test DB pattern"), so none leaves a row
		// behind for this assertion to trip over.
		const client = await connectedClient(createMockFetch(basisVector(0)));
		const result = await client.callTool({
			name: "list_campaigns",
			arguments: {},
		});

		expect(result.isError).toBeFalsy();
		const content = result.content as Array<{ type: string; text: string }>;
		const payload = JSON.parse(content[0]?.text ?? "{}");
		expect(payload.campaigns).toEqual([]);
	});
});
