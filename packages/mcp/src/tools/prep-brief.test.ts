import { campaignWealth } from "@questlog/core/db/schema/index.js";
import { basisVector } from "@questlog/core/db/test-helpers.js";
import { campaignService } from "@questlog/core/services/campaign.service.js";
import { entityService } from "@questlog/core/services/entity.service.js";
import { inventoryService } from "@questlog/core/services/inventory.service.js";
import { sessionService } from "@questlog/core/services/session.service.js";
import { sql } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { connectedClient, createMockFetch, db } from "../test-helpers.js";

describe("prep_brief tool", () => {
	let campaignId: string;

	beforeEach(async () => {
		await db.execute(sql`BEGIN`);
		vi.clearAllMocks();

		const campaign = await campaignService.create(db, {
			name: "Curse of Strahd",
			theme: "horror",
		});
		campaignId = campaign.id;
	});

	afterEach(async () => {
		await db.execute(sql`ROLLBACK`);
	});

	it("returns previously-on text and the mentioned NPC under likely NPCs", async () => {
		const npc = await entityService.create(db, {
			campaignId,
			name: "Izek Strazni",
			type: "npc",
			description: "Obsessed with Ireena.",
		});
		const s1 = await sessionService.create(db, {
			campaignId,
			content: "Izek Strazni was seen watching Ireena from the square.",
		});
		await sessionService.linkEntities(db, s1.id, [
			{
				entityId: npc.id,
				entityName: "Izek Strazni",
				entityType: "npc",
				startIndex: 0,
				endIndex: 12,
				matchType: "confirmed",
				candidates: [],
			},
		]);
		const s2 = await sessionService.create(db, {
			campaignId,
			content: "The party rests at the inn.",
		});
		await sessionService.finalize(db, {
			id: s2.id,
			summary: "The party rested at the inn after a long day.",
		});

		const client = await connectedClient(createMockFetch(basisVector(0)));

		const result = await client.callTool({
			name: "prep_brief",
			arguments: { campaignId },
		});

		expect(result.isError).toBeFalsy();
		const content = result.content as Array<{ type: string; text: string }>;
		const brief = JSON.parse(content[0]?.text ?? "{}");
		expect(brief.previouslyOn[0]?.text).toBe(
			"The party rested at the inn after a long day.",
		);
		expect(brief.likelyNpcs).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ entityId: npc.id, name: "Izek Strazni" }),
			]),
		);
	});

	it("returns a well-formed empty brief for a campaign with zero sessions", async () => {
		const client = await connectedClient(createMockFetch(basisVector(0)));

		const result = await client.callTool({
			name: "prep_brief",
			arguments: { campaignId },
		});

		expect(result.isError).toBeFalsy();
		const content = result.content as Array<{ type: string; text: string }>;
		const brief = JSON.parse(content[0]?.text ?? "{}");
		expect(brief.previouslyOn).toEqual([]);
		expect(brief.activeThreads).toEqual([]);
		expect(brief.likelyNpcs).toEqual([]);
		expect(brief.quickLinks).toEqual([]);
		expect(brief.looseEnds.items).toEqual([]);
		expect(brief.suggestedFollowUps.items).toEqual([]);
	});

	it("returns isError for an unknown campaignId instead of throwing", async () => {
		const client = await connectedClient(createMockFetch(basisVector(0)));
		const unknownCampaignId = "00000000-0000-0000-0000-000000000000";

		const result = await client.callTool({
			name: "prep_brief",
			arguments: { campaignId: unknownCampaignId },
		});

		expect(result.isError).toBe(true);
		const content = result.content as Array<{ type: string; text: string }>;
		expect(content[0]?.text).toContain(unknownCampaignId);
	});

	it("surfaces campaign wealth and unassigned items (T-144)", async () => {
		// adjustWealth opens its own db.transaction() (inventory.service.ts),
		// which doesn't compose with this describe block's raw BEGIN/ROLLBACK
		// wrapper (.claude/rules/backend.md "Test DB pattern") — insert the
		// wealth row directly instead.
		await db.insert(campaignWealth).values({ campaignId, amount: 75 });
		await inventoryService.addItem(db, { campaignId, name: "Torch" });
		await inventoryService.addItem(db, { campaignId, name: "Rope" });

		const client = await connectedClient(createMockFetch(basisVector(0)));
		const result = await client.callTool({
			name: "prep_brief",
			arguments: { campaignId },
		});

		expect(result.isError).toBeFalsy();
		const content = result.content as Array<{ type: string; text: string }>;
		const brief = JSON.parse(content[0]?.text ?? "{}");
		expect(brief.wealth).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ denomination: "wealth", amount: 75 }),
			]),
		);
		expect(
			brief.unassignedItems.map((i: { name: string }) => i.name).sort(),
		).toEqual(["Rope", "Torch"]);
	});
});
