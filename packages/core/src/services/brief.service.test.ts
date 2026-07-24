import { sql } from "drizzle-orm";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "../db/test-helpers.js";
import { NotFoundError } from "../lib/errors.js";
import { briefService } from "./brief.service.js";
import { campaignService } from "./campaign.service.js";
import { entityService } from "./entity.service.js";
import { sessionService } from "./session.service.js";

const { db, close } = createTestDb();

afterAll(async () => {
	await close();
});

describe("briefService", () => {
	let campaignId: string;

	beforeEach(async () => {
		await db.execute(sql`BEGIN`);
		const campaign = await campaignService.create(db, {
			name: "Curse of Strahd",
			theme: "horror",
		});
		campaignId = campaign.id;
	});

	afterEach(async () => {
		await db.execute(sql`ROLLBACK`);
	});

	describe("previously on", () => {
		it("uses the latest session's summary when present", async () => {
			await sessionService.create(db, { campaignId, content: "Session one." });
			const s2 = await sessionService.create(db, {
				campaignId,
				content: "Session two.",
			});
			await sessionService.finalize(db, {
				id: s2.id,
				summary: "The party recovered the bones of St. Andral.",
			});

			const brief = await briefService.assemble(db, { campaignId });

			expect(brief.previouslyOn[0]?.sessionNumber).toBe(2);
			expect(brief.previouslyOn[0]?.text).toBe(
				"The party recovered the bones of St. Andral.",
			);
		});

		it("falls back to session content when summary is null", async () => {
			await sessionService.create(db, {
				campaignId,
				content: "Henrik has gone missing from his coffin shop.",
			});

			const brief = await briefService.assemble(db, { campaignId });

			expect(brief.previouslyOn[0]?.text).toBe(
				"Henrik has gone missing from his coffin shop.",
			);
		});
	});

	describe("active plot threads", () => {
		it("treats a tag repeated across sessions with no resolved marker as open", async () => {
			const s1 = await sessionService.create(db, {
				campaignId,
				content: "Izek watches Ireena from the square.",
			});
			await sessionService.finalize(db, {
				id: s1.id,
				tags: ["izeks-obsession"],
			});
			const s2 = await sessionService.create(db, {
				campaignId,
				content: "Izek is seen again near the mill.",
			});
			await sessionService.finalize(db, {
				id: s2.id,
				sessionNumber: 2,
				tags: ["izeks-obsession"],
			});

			const brief = await briefService.assemble(db, { campaignId });

			expect(brief.activeThreads).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						tag: "izeks-obsession",
						lastTouchedSessionNumber: 2,
					}),
				]),
			);
		});

		it("excludes a tag once a later session marks it resolved", async () => {
			const s1 = await sessionService.create(db, {
				campaignId,
				content: "The party seeks the bones of St. Andral.",
			});
			await sessionService.finalize(db, { id: s1.id, tags: ["bones"] });
			const s2 = await sessionService.create(db, {
				campaignId,
				content: "The bones are restored to the church.",
			});
			await sessionService.finalize(db, {
				id: s2.id,
				sessionNumber: 2,
				tags: ["resolved:bones"],
			});

			const brief = await briefService.assemble(db, { campaignId });

			expect(brief.activeThreads.map((t) => t.tag)).not.toContain("bones");
		});

		it("keeps a resolved tag closed even if a later session uses it again", async () => {
			const s1 = await sessionService.create(db, {
				campaignId,
				content: "The party seeks the bones of St. Andral.",
			});
			await sessionService.finalize(db, { id: s1.id, tags: ["bones"] });
			const s2 = await sessionService.create(db, {
				campaignId,
				content: "The bones are restored to the church.",
			});
			await sessionService.finalize(db, {
				id: s2.id,
				sessionNumber: 2,
				tags: ["resolved:bones"],
			});
			const s3 = await sessionService.create(db, {
				campaignId,
				content: "Rumors about the bones resurface.",
			});
			await sessionService.finalize(db, {
				id: s3.id,
				sessionNumber: 3,
				tags: ["bones"],
			});

			const brief = await briefService.assemble(db, { campaignId });

			expect(brief.activeThreads.map((t) => t.tag)).not.toContain("bones");
		});
	});

	describe("likely NPCs", () => {
		it("surfaces an NPC entity mentioned in a recent session and mirrors it in quick links", async () => {
			const npc = await entityService.create(db, {
				campaignId,
				name: "Izek Strazni",
				type: "npc",
				description: "Obsessed with Ireena.",
			});
			const session = await sessionService.create(db, {
				campaignId,
				content: "Izek Strazni was seen watching Ireena from the square.",
			});
			await sessionService.linkEntities(db, session.id, [
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

			const brief = await briefService.assemble(db, { campaignId });

			expect(brief.likelyNpcs).toEqual(
				expect.arrayContaining([
					expect.objectContaining({ entityId: npc.id, name: "Izek Strazni" }),
				]),
			);
			expect(brief.quickLinks).toEqual(
				expect.arrayContaining([
					expect.objectContaining({ entityId: npc.id, name: "Izek Strazni" }),
				]),
			);
		});

		it("excludes a mentioned entity that is not an NPC", async () => {
			const location = await entityService.create(db, {
				campaignId,
				name: "Old Bonegrinder",
				type: "location",
				description: "A windmill.",
			});
			const session = await sessionService.create(db, {
				campaignId,
				content: "The party approaches Old Bonegrinder at dusk.",
			});
			await sessionService.linkEntities(db, session.id, [
				{
					entityId: location.id,
					entityName: "Old Bonegrinder",
					entityType: "location",
					startIndex: 0,
					endIndex: 15,
					matchType: "confirmed",
					candidates: [],
				},
			]);

			const brief = await briefService.assemble(db, { campaignId });

			expect(brief.likelyNpcs).toEqual([]);
		});

		it("excludes an entity textually mentioned but never linked via session_entities", async () => {
			await entityService.create(db, {
				campaignId,
				name: "Izek Strazni",
				type: "npc",
				description: "Obsessed with Ireena.",
			});
			await sessionService.create(db, {
				campaignId,
				content: "Izek Strazni was seen watching Ireena from the square.",
			});

			const brief = await briefService.assemble(db, { campaignId });

			expect(brief.likelyNpcs).toEqual([]);
			expect(brief.quickLinks).toEqual([]);
		});

		it("excludes an NPC whose only link is not a confirmed match", async () => {
			const npc = await entityService.create(db, {
				campaignId,
				name: "Izek Strazni",
				type: "npc",
				description: "Obsessed with Ireena.",
			});
			const session = await sessionService.create(db, {
				campaignId,
				content: "Izek Strazni was seen watching Ireena from the square.",
			});
			await sessionService.linkEntities(db, session.id, [
				{
					entityId: npc.id,
					entityName: "Izek Strazni",
					entityType: "npc",
					startIndex: 0,
					endIndex: 12,
					matchType: "ambiguous",
					candidates: [],
				},
			]);

			const brief = await briefService.assemble(db, { campaignId });

			expect(brief.likelyNpcs).toEqual([]);
			expect(brief.quickLinks).toEqual([]);
		});
	});

	describe("empty campaign", () => {
		it("returns a well-formed empty brief when the campaign has no sessions", async () => {
			const brief = await briefService.assemble(db, { campaignId });

			expect(brief.previouslyOn).toEqual([]);
			expect(brief.activeThreads).toEqual([]);
			expect(brief.likelyNpcs).toEqual([]);
			expect(brief.quickLinks).toEqual([]);
			expect(brief.looseEnds.items).toEqual([]);
			expect(brief.looseEnds.note).toEqual(expect.any(String));
			expect(brief.suggestedFollowUps.items).toEqual([]);
			expect(brief.suggestedFollowUps.note).toEqual(expect.any(String));
		});
	});

	describe("unknown campaign", () => {
		it("throws NotFoundError", async () => {
			await expect(
				briefService.assemble(db, {
					campaignId: "00000000-0000-0000-0000-000000000000",
				}),
			).rejects.toThrow(NotFoundError);
		});
	});
});
