import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, deleteCampaignTree } from "../db/test-helpers.js";
import { NotFoundError } from "../lib/errors.js";
import { campaignService } from "./campaign.service.js";
import { encounterService } from "./encounter.service.js";
import { entityService } from "./entity.service.js";

const { db, close } = createTestDb();

afterAll(async () => {
	await close();
});

// save() opens its own db.transaction() — a nested raw BEGIN/ROLLBACK
// wrapper doesn't compose with that (.claude/rules/backend.md "Test DB
// pattern"), so this suite uses explicit FK-safe cleanup instead, same as
// inventory.service.test.ts.
describe("encounterService", () => {
	let campaignId: string;
	let goblinId: string;
	let ogreId: string;

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

		const ogre = await entityService.create(db, {
			campaignId,
			name: "Ogre",
			type: "npc",
		});
		ogreId = ogre.id;
	});

	afterEach(async () => {
		await deleteCampaignTree(db, campaignId);
	});

	describe("save", () => {
		it("persists the encounter and every member row", async () => {
			const encounter = await encounterService.save(db, {
				campaignId,
				name: "Ambush at the bridge",
				notes: "Goblins spring from the reeds",
				members: [
					{ entityId: goblinId, count: 2 },
					{ entityId: ogreId, count: 1 },
				],
			});

			expect(encounter.name).toBe("Ambush at the bridge");

			const fetched = await encounterService.getById(
				db,
				campaignId,
				encounter.id,
			);
			expect(fetched.name).toBe("Ambush at the bridge");
			expect(fetched.notes).toBe("Goblins spring from the reeds");
			expect(fetched.members).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						entityId: goblinId,
						name: "Goblin",
						type: "npc",
						count: 2,
					}),
					expect.objectContaining({
						entityId: ogreId,
						name: "Ogre",
						type: "npc",
						count: 1,
					}),
				]),
			);
			expect(fetched.members).toHaveLength(2);
		});

		it("throws NotFoundError when a member entityId belongs to a different campaign", async () => {
			const otherCampaign = await campaignService.create(db, {
				name: "Other Campaign",
				theme: "fantasy",
			});
			const foreignEntity = await entityService.create(db, {
				campaignId: otherCampaign.id,
				name: "Stranger",
				type: "npc",
			});

			await expect(
				encounterService.save(db, {
					campaignId,
					name: "Doomed roster",
					members: [{ entityId: foreignEntity.id, count: 1 }],
				}),
			).rejects.toThrow(NotFoundError);

			await deleteCampaignTree(db, otherCampaign.id);
		});
	});

	describe("save edge cases", () => {
		it("saves an encounter with no members", async () => {
			const encounter = await encounterService.save(db, {
				campaignId,
				name: "Empty roster",
				members: [],
			});
			const fetched = await encounterService.getById(
				db,
				campaignId,
				encounter.id,
			);
			expect(fetched.members).toEqual([]);
		});

		it("throws NotFoundError for a nonexistent campaign, even with no members", async () => {
			await expect(
				encounterService.save(db, {
					campaignId: "00000000-0000-4000-8000-000000000000",
					name: "Orphan",
					members: [],
				}),
			).rejects.toThrow(NotFoundError);
		});

		it("accepts the same entity listed twice", async () => {
			const encounter = await encounterService.save(db, {
				campaignId,
				name: "Split goblins",
				members: [
					{ entityId: goblinId, count: 1 },
					{ entityId: goblinId, count: 2 },
				],
			});
			const fetched = await encounterService.getById(
				db,
				campaignId,
				encounter.id,
			);
			expect(fetched.members).toHaveLength(2);
		});
	});

	describe("getById", () => {
		it("throws NotFoundError for a nonexistent encounter", async () => {
			await expect(
				encounterService.getById(
					db,
					campaignId,
					"00000000-0000-4000-8000-000000000000",
				),
			).rejects.toThrow(NotFoundError);
		});

		it("throws NotFoundError when the encounter belongs to a different campaign", async () => {
			const other = await campaignService.create(db, {
				name: "Other Campaign",
				theme: "fantasy",
			});
			const encounter = await encounterService.save(db, {
				campaignId,
				name: "Private",
				members: [{ entityId: goblinId, count: 1 }],
			});

			await expect(
				encounterService.getById(db, other.id, encounter.id),
			).rejects.toThrow(NotFoundError);

			await deleteCampaignTree(db, other.id);
		});
	});

	describe("list", () => {
		it("returns every saved encounter with a member-count summary, not full member detail", async () => {
			await encounterService.save(db, {
				campaignId,
				name: "Ambush at the bridge",
				members: [
					{ entityId: goblinId, count: 2 },
					{ entityId: ogreId, count: 1 },
				],
			});
			await encounterService.save(db, {
				campaignId,
				name: "Ogre's den",
				members: [{ entityId: ogreId, count: 1 }],
			});

			const encounters = await encounterService.list(db, campaignId);

			expect(encounters).toHaveLength(2);
			for (const encounter of encounters) {
				expect(encounter).not.toHaveProperty("members");
			}
			expect(encounters.map((e) => [e.name, e.memberCount])).toEqual([
				["Ambush at the bridge", 2],
				["Ogre's den", 1],
			]);
		});
	});
});
