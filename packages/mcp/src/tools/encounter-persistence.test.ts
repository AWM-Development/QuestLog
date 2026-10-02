import {
	basisVector,
	deleteCampaignTree,
} from "@questlog/core/db/test-helpers.js";
import { campaignService } from "@questlog/core/services/campaign.service.js";
import { entityService } from "@questlog/core/services/entity.service.js";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { connectedClient, createMockFetch, db } from "../test-helpers.js";

// save_encounter opens its own db.transaction() — explicit FK-safe cleanup
// instead of the raw BEGIN/ROLLBACK wrapper, same as add-item.test.ts.
describe("save_encounter / list_encounters / get_encounter tools", () => {
	let campaignId: string;
	let goblinId: string;

	beforeEach(async () => {
		const campaign = await campaignService.create(db, {
			name: "Ashfall Primer Campaign",
			theme: "fantasy",
		});
		campaignId = campaign.id;
		const goblin = await entityService.create(db, {
			campaignId,
			name: "Goblin",
			type: "npc",
		});
		goblinId = goblin.id;
	});

	afterEach(async () => {
		await deleteCampaignTree(db, campaignId);
	});

	function parse(result: unknown) {
		const content = (result as { content: Array<{ text: string }> }).content;
		return JSON.parse(content[0]?.text ?? "{}");
	}

	it("defaults a member's count to 1 and round-trips through list/get", async () => {
		const client = await connectedClient(createMockFetch(basisVector(0)));

		const saved = await client.callTool({
			name: "save_encounter",
			arguments: {
				campaignId,
				name: "Bridge ambush",
				members: [{ entityId: goblinId }],
			},
		});
		expect(saved.isError).toBeFalsy();
		const encounter = parse(saved);

		const listed = parse(
			await client.callTool({
				name: "list_encounters",
				arguments: { campaignId },
			}),
		);
		expect(listed).toHaveLength(1);
		expect(listed[0].memberCount).toBe(1);

		const fetched = parse(
			await client.callTool({
				name: "get_encounter",
				arguments: { campaignId, encounterId: encounter.id },
			}),
		);
		expect(fetched.members).toEqual([
			expect.objectContaining({ entityId: goblinId, name: "Goblin", count: 1 }),
		]);
	});

	it("save_encounter returns NOT_FOUND for an unknown entityId", async () => {
		const client = await connectedClient(createMockFetch(basisVector(0)));
		const result = await client.callTool({
			name: "save_encounter",
			arguments: {
				campaignId,
				name: "Bad roster",
				members: [{ entityId: "00000000-0000-4000-8000-000000000000" }],
			},
		});
		expect(result.isError).toBe(true);
		expect(parse(result).error.code).toBe("NOT_FOUND");
	});

	it("get_encounter returns NOT_FOUND for an unknown encounterId", async () => {
		const client = await connectedClient(createMockFetch(basisVector(0)));
		const result = await client.callTool({
			name: "get_encounter",
			arguments: {
				campaignId,
				encounterId: "00000000-0000-4000-8000-000000000000",
			},
		});
		expect(result.isError).toBe(true);
		expect(parse(result).error.code).toBe("NOT_FOUND");
	});
});
