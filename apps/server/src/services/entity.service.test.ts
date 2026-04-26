import { sql } from "drizzle-orm";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "../db/test-helpers.js";
import { campaignService } from "./campaign.service.js";
import { entityService } from "./entity.service.js";

const { db, close } = createTestDb();

afterAll(async () => {
	await close();
});

describe("entityService.detectSpans", () => {
	let campaignId: string;

	beforeEach(async () => {
		await db.execute(sql`BEGIN`);
		const campaign = await campaignService.create(db, {
			name: "Test Campaign",
			theme: "fantasy",
		});
		campaignId = campaign.id;
	});

	afterEach(async () => {
		await db.execute(sql`ROLLBACK`);
	});

	async function insertEntity(
		name: string,
		type = "npc",
	): Promise<{ id: string }> {
		const rows = await db.execute(sql`
      INSERT INTO entities (campaign_id, name, type)
      VALUES (${campaignId}, ${name}, ${type})
      RETURNING id
    `);
		return rows[0] as { id: string };
	}

	it("returns empty array when campaign has no entities", async () => {
		const spans = await entityService.detectSpans(db, {
			campaignId,
			text: "Strahd appeared at the gate",
			dismissedEntityTexts: [],
		});
		expect(spans).toEqual([]);
	});

	it("returns empty array when text has no matches", async () => {
		await insertEntity("Strahd");
		const spans = await entityService.detectSpans(db, {
			campaignId,
			text: "Nothing interesting happened today",
			dismissedEntityTexts: [],
		});
		expect(spans).toEqual([]);
	});

	it("detects exact match case-insensitively with correct indices", async () => {
		const entity = await insertEntity("Strahd");
		const text = "Strahd appeared at the gate";
		const spans = await entityService.detectSpans(db, {
			campaignId,
			text,
			dismissedEntityTexts: [],
		});
		expect(spans).toHaveLength(1);
		expect(spans[0]?.entityId).toBe(entity.id);
		expect(spans[0]?.entityName).toBe("Strahd");
		expect(spans[0]?.entityType).toBe("npc");
		expect(spans[0]?.startIndex).toBe(0);
		expect(spans[0]?.endIndex).toBe(6);
		expect(spans[0]?.matchType).toBe("confirmed");
	});

	it("detects fuzzy match with typo (similarity >= 0.4)", async () => {
		const entity = await insertEntity("Strahd");
		const text = "Straahd walked through the mist";
		const spans = await entityService.detectSpans(db, {
			campaignId,
			text,
			dismissedEntityTexts: [],
		});
		expect(spans).toHaveLength(1);
		expect(spans[0]?.entityId).toBe(entity.id);
		expect(spans[0]?.entityName).toBe("Strahd");
	});

	it("detects multiple non-overlapping entities", async () => {
		const strahd = await insertEntity("Strahd");
		const ravenloft = await insertEntity("Castle Ravenloft", "location");
		const text = "Strahd rules from Castle Ravenloft";
		const spans = await entityService.detectSpans(db, {
			campaignId,
			text,
			dismissedEntityTexts: [],
		});
		expect(spans).toHaveLength(2);
		const names = spans.map((s) => s.entityName).sort();
		expect(names).toContain("Strahd");
		expect(names).toContain("Castle Ravenloft");
		// No overlaps
		const strahdSpan = spans.find((s) => s.entityId === strahd.id);
		const ravenloftSpan = spans.find((s) => s.entityId === ravenloft.id);
		expect(strahdSpan).toBeDefined();
		expect(ravenloftSpan).toBeDefined();
		expect(strahdSpan?.endIndex).toBeLessThanOrEqual(
			ravenloftSpan?.startIndex ?? 0,
		);
	});

	it("prefers longer match when both entity names match at same position", async () => {
		await insertEntity("Guard", "npc");
		await insertEntity("Guard Captain", "npc");
		const text = "The Guard Captain entered the room";
		const spans = await entityService.detectSpans(db, {
			campaignId,
			text,
			dismissedEntityTexts: [],
		});
		// Longer match "Guard Captain" should win over shorter "Guard"
		const names = spans.map((s) => s.entityName);
		expect(names).toContain("Guard Captain");
		expect(names).not.toContain("Guard");
	});

	it("excludes spans whose normalized text is in dismissedEntityTexts", async () => {
		await insertEntity("Strahd");
		const text = "Strahd appeared at the gate";
		const spans = await entityService.detectSpans(db, {
			campaignId,
			text,
			dismissedEntityTexts: ["strahd"],
		});
		expect(spans).toEqual([]);
	});

	it("marks span as ambiguous when two distinct entities match the same span", async () => {
		await insertEntity("Strahd", "npc");
		await insertEntity("Strahd", "arc");
		const text = "Strahd loomed over the village";
		const spans = await entityService.detectSpans(db, {
			campaignId,
			text,
			dismissedEntityTexts: [],
		});
		expect(spans).toHaveLength(1);
		expect(spans[0]?.matchType).toBe("ambiguous");
		expect(spans[0]?.candidates.length).toBeGreaterThanOrEqual(2);
	});
});
