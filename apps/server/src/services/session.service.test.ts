import { sql } from "drizzle-orm";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "../db/test-helpers.js";
import { NotFoundError } from "../lib/errors.js";
import { campaignService } from "./campaign.service.js";
import { entityService } from "./entity.service.js";
import { sessionService } from "./session.service.js";

const { db, close } = createTestDb();

afterAll(async () => {
	await close();
});

describe("sessionService", () => {
	let campaignId: string;

	beforeEach(async () => {
		await db.execute(sql`BEGIN`);
		const c = await campaignService.create(db, {
			name: "Test Campaign",
			theme: "fantasy",
		});
		campaignId = c.id;
	});

	afterEach(async () => {
		await db.execute(sql`ROLLBACK`);
	});

	describe("create", () => {
		it("creates a session with sessionNumber 1 and status draft", async () => {
			const s = await sessionService.create(db, { campaignId });

			expect(s.sessionNumber).toBe(1);
			expect(s.status).toBe("draft");
			expect(s.content).toBe("");
			expect(s.campaignId).toBe(campaignId);
			expect(s.date).toBeInstanceOf(Date);
		});

		it("increments sessionNumber per campaign", async () => {
			const a = await sessionService.create(db, { campaignId });
			const b = await sessionService.create(db, { campaignId });
			expect(a.sessionNumber).toBe(1);
			expect(b.sessionNumber).toBe(2);
		});

		it("accepts optional title and content", async () => {
			const s = await sessionService.create(db, {
				campaignId,
				title: "Session A",
				content: '{"type":"doc","content":[]}',
			});
			expect(s.title).toBe("Session A");
			expect(s.content).toBe('{"type":"doc","content":[]}');
		});

		it("throws NotFoundError for unknown campaign", async () => {
			await expect(
				sessionService.create(db, {
					campaignId: "00000000-0000-0000-0000-000000000000",
				}),
			).rejects.toThrow(NotFoundError);
		});
	});

	describe("getById", () => {
		it("returns a session when it exists", async () => {
			const created = await sessionService.create(db, { campaignId });
			const found = await sessionService.getById(db, created.id);
			expect(found.id).toBe(created.id);
		});

		it("throws NotFoundError for missing id", async () => {
			await expect(
				sessionService.getById(db, "00000000-0000-0000-0000-000000000000"),
			).rejects.toThrow(NotFoundError);
		});
	});

	describe("list", () => {
		it("returns sessions ordered by sessionNumber descending", async () => {
			await sessionService.create(db, { campaignId, title: "One" });
			await sessionService.create(db, { campaignId, title: "Two" });

			const rows = await sessionService.list(db, campaignId);
			expect(rows).toHaveLength(2);
			expect(rows[0]?.sessionNumber).toBe(2);
			expect(rows[1]?.sessionNumber).toBe(1);
		});

		it("returns empty array when campaign has no sessions", async () => {
			const rows = await sessionService.list(db, campaignId);
			expect(rows).toEqual([]);
		});
	});

	describe("update", () => {
		it("updates provided fields", async () => {
			const created = await sessionService.create(db, { campaignId });
			const updated = await sessionService.update(db, {
				id: created.id,
				title: "Updated",
				content: '{"type":"doc","content":[]}',
			});
			expect(updated.title).toBe("Updated");
			expect(updated.content).toBe('{"type":"doc","content":[]}');
		});

		it("throws NotFoundError for missing session", async () => {
			await expect(
				sessionService.update(db, {
					id: "00000000-0000-0000-0000-000000000000",
					title: "Nope",
				}),
			).rejects.toThrow(NotFoundError);
		});
	});

	describe("finalize", () => {
		it("sets status to finalized and applies metadata", async () => {
			const created = await sessionService.create(db, { campaignId });
			const done = await sessionService.finalize(db, {
				id: created.id,
				title: "Finale",
				summary: "Done",
				tags: ["a", "b"],
			});
			expect(done.status).toBe("finalized");
			expect(done.title).toBe("Finale");
			expect(done.summary).toBe("Done");
			expect(done.tags).toEqual(["a", "b"]);
		});

		it("throws NotFoundError for missing session", async () => {
			await expect(
				sessionService.finalize(db, {
					id: "00000000-0000-0000-0000-000000000000",
				}),
			).rejects.toThrow(NotFoundError);
		});
	});

	describe("linkEntities", () => {
		it("inserts one session_entities row per span", async () => {
			const session = await sessionService.create(db, { campaignId });
			const entityA = await entityService.create(db, {
				campaignId,
				name: "Mira Duskwood",
				type: "npc",
			});
			const entityB = await entityService.create(db, {
				campaignId,
				name: "Ashfall Peak",
				type: "location",
			});

			const linked = await sessionService.linkEntities(db, session.id, [
				{
					entityId: entityA.id,
					entityName: "Mira Duskwood",
					entityType: "npc",
					startIndex: 0,
					endIndex: 13,
					matchType: "confirmed",
					candidates: [],
				},
				{
					entityId: entityB.id,
					entityName: "Ashfall Peak",
					entityType: "location",
					startIndex: 20,
					endIndex: 32,
					matchType: "ambiguous",
					candidates: [],
				},
			]);

			expect(linked).toHaveLength(2);
			expect(linked[0]?.entityId).toBe(entityA.id);
			expect(linked[0]?.matchType).toBe("confirmed");
			expect(linked[1]?.entityId).toBe(entityB.id);
			expect(linked[1]?.matchType).toBe("ambiguous");

			const rows = await db.execute(sql`
        SELECT session_id, entity_id, match_type FROM session_entities
        WHERE session_id = ${session.id}
      `);
			expect(rows).toHaveLength(2);
		});

		it("inserts nothing and returns an empty array for zero spans", async () => {
			const session = await sessionService.create(db, { campaignId });

			const linked = await sessionService.linkEntities(db, session.id, []);

			expect(linked).toEqual([]);
			const rows = await db.execute(sql`
        SELECT id FROM session_entities WHERE session_id = ${session.id}
      `);
			expect(rows).toHaveLength(0);
		});
	});
});
