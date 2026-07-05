import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb } from "../db/test-helpers.js";
import { campaignService } from "./campaign.service.js";
import { sessionService } from "./session.service.js";

const { db, close } = createTestDb();

afterAll(async () => {
	await close();
});

describe("CP-1: Schema migration — dismissedEntityTexts", () => {
	describe("sessions.dismissed_entity_texts column", () => {
		it("column exists and defaults to empty array", async () => {
			const rows = await db.execute(sql`
        SELECT column_name, column_default, data_type
        FROM information_schema.columns
        WHERE table_name = 'sessions'
          AND column_name = 'dismissed_entity_texts'
      `);
			expect(rows.length).toBe(1);
			const col = rows[0] as {
				column_name: string;
				column_default: string;
				data_type: string;
			};
			expect(col.column_name).toBe("dismissed_entity_texts");
			expect(col.data_type).toBe("jsonb");
			expect(col.column_default).toContain("[]");
		});
	});

	describe("entities_name_trgm_idx GIN index", () => {
		it("GIN trigram index exists on entities.name", async () => {
			const rows = await db.execute(sql`
        SELECT indexname, indexdef
        FROM pg_indexes
        WHERE tablename = 'entities'
          AND indexname = 'entities_name_trgm_idx'
      `);
			expect(rows.length).toBe(1);
			const idx = rows[0] as { indexname: string; indexdef: string };
			expect(idx.indexname).toBe("entities_name_trgm_idx");
			expect(idx.indexdef.toLowerCase()).toContain("gin");
		});
	});

	describe("session.update round-trips dismissedEntityTexts", () => {
		let campaignId: string;

		beforeAll(async () => {
			const campaign = await campaignService.create(db, {
				name: "Test Campaign for CP-1",
				theme: "fantasy",
			});
			campaignId = campaign.id;
		});

		it("persists dismissedEntityTexts through session.update", async () => {
			const session = await sessionService.create(db, { campaignId });

			const updated = await sessionService.update(db, {
				id: session.id,
				dismissedEntityTexts: ["strahd", "castle ravenloft"],
			});

			expect(updated.dismissedEntityTexts).toEqual([
				"strahd",
				"castle ravenloft",
			]);
		});

		it("dismissedEntityTexts defaults to empty array on creation", async () => {
			const session = await sessionService.create(db, { campaignId });
			expect(session.dismissedEntityTexts).toEqual([]);
		});
	});
});
