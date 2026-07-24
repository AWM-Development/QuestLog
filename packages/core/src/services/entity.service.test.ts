import { sql } from "drizzle-orm";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "../db/test-helpers.js";
import { NotFoundError } from "../lib/errors.js";
import { campaignService } from "./campaign.service.js";
import { entityService, extractExcerpt } from "./entity.service.js";

const { db, close } = createTestDb();

afterAll(async () => {
	await close();
});

async function insertEntity(
	campaignId: string,
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

	it("returns empty array when campaign has no entities", async () => {
		const spans = await entityService.detectSpans(db, {
			campaignId,
			text: "Strahd appeared at the gate",
			dismissedEntityTexts: [],
		});
		expect(spans).toEqual([]);
	});

	it("returns empty array when text has no matches", async () => {
		await insertEntity(campaignId, "Strahd");
		const spans = await entityService.detectSpans(db, {
			campaignId,
			text: "Nothing interesting happened today",
			dismissedEntityTexts: [],
		});
		expect(spans).toEqual([]);
	});

	it("detects exact match case-insensitively with correct indices", async () => {
		const entity = await insertEntity(campaignId, "Strahd");
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
		const entity = await insertEntity(campaignId, "Strahd");
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
		const strahd = await insertEntity(campaignId, "Strahd");
		const ravenloft = await insertEntity(
			campaignId,
			"Castle Ravenloft",
			"location",
		);
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
		await insertEntity(campaignId, "Guard", "npc");
		await insertEntity(campaignId, "Guard Captain", "npc");
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
		await insertEntity(campaignId, "Strahd");
		const text = "Strahd appeared at the gate";
		const spans = await entityService.detectSpans(db, {
			campaignId,
			text,
			dismissedEntityTexts: ["strahd"],
		});
		expect(spans).toEqual([]);
	});

	it("marks span as ambiguous when two distinct entities match the same span", async () => {
		await insertEntity(campaignId, "Strahd", "npc");
		await insertEntity(campaignId, "Strahd", "arc");
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

describe("entityService.getById", () => {
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

	it("returns the entity for a matching id and campaign", async () => {
		const entity = await insertEntity(campaignId, "Strahd");
		const found = await entityService.getById(db, campaignId, entity.id);
		expect(found.id).toBe(entity.id);
		expect(found.name).toBe("Strahd");
	});

	it("throws NotFoundError for an id that does not exist", async () => {
		await expect(
			entityService.getById(
				db,
				campaignId,
				"00000000-0000-0000-0000-000000000000",
			),
		).rejects.toThrow(NotFoundError);
	});

	it("throws NotFoundError when the entity belongs to a different campaign", async () => {
		const otherCampaign = await campaignService.create(db, {
			name: "Other Campaign",
			theme: "fantasy",
		});
		const entity = await insertEntity(otherCampaign.id, "Strahd");
		await expect(
			entityService.getById(db, campaignId, entity.id),
		).rejects.toThrow(NotFoundError);
	});
});

describe("entityService.getByName", () => {
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

	it("returns the entity for an exact name match", async () => {
		const entity = await insertEntity(campaignId, "Strahd");
		const found = await entityService.getByName(db, campaignId, "Strahd");
		expect(found.id).toBe(entity.id);
	});

	it("returns the correct entity via fuzzy match on a typo'd name", async () => {
		const entity = await insertEntity(campaignId, "Strahd");
		const found = await entityService.getByName(db, campaignId, "Sthrahd");
		expect(found.id).toBe(entity.id);
	});

	it("throws NotFoundError when nothing clears the fuzzy match threshold", async () => {
		await insertEntity(campaignId, "Strahd");
		await expect(
			entityService.getByName(db, campaignId, "Zzyzx Nonexistent"),
		).rejects.toThrow(NotFoundError);
	});
});

describe("entityService.list with type filter", () => {
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

	it("returns all entities when type is omitted", async () => {
		await insertEntity(campaignId, "Strahd", "npc");
		await insertEntity(campaignId, "Castle Ravenloft", "location");
		const results = await entityService.list(db, campaignId);
		expect(results).toHaveLength(2);
	});

	it("returns only the matching subset when type is passed", async () => {
		await insertEntity(campaignId, "Strahd", "npc");
		await insertEntity(campaignId, "Castle Ravenloft", "location");
		const results = await entityService.list(db, campaignId, "npc");
		expect(results).toHaveLength(1);
		expect(results[0]?.name).toBe("Strahd");
	});
});

describe("entityService.appendToDescription", () => {
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

	it("appends to an existing description with a separator", async () => {
		const entity = await entityService.create(db, {
			campaignId,
			name: "Strahd",
			type: "npc",
			description: "The vampire lord of Barovia.",
		});

		const updated = await entityService.appendToDescription(
			db,
			entity.id,
			"Seen prowling the castle halls at night.",
		);

		expect(updated.description).toBe(
			"The vampire lord of Barovia.\n\nSeen prowling the castle halls at night.",
		);
	});

	it("sets the description when none exists yet", async () => {
		const entity = await entityService.create(db, {
			campaignId,
			name: "Ismark",
			type: "npc",
		});

		const updated = await entityService.appendToDescription(
			db,
			entity.id,
			"Met the party at the tavern.",
		);

		expect(updated.description).toBe("Met the party at the tavern.");
	});

	it("throws NotFoundError for a nonexistent entity", async () => {
		const unknownId = "00000000-0000-0000-0000-000000000000";
		await expect(
			entityService.appendToDescription(db, unknownId, "note"),
		).rejects.toThrow(NotFoundError);
	});
});

describe("extractExcerpt", () => {
	it("returns the sentence containing the span when surrounded by other sentences", () => {
		const text =
			"The party entered the tavern. Mira Duskwood greeted them warmly. They ordered ale.";
		const startIndex = text.indexOf("Mira Duskwood");
		const endIndex = startIndex + "Mira Duskwood".length;

		const excerpt = extractExcerpt(text, { startIndex, endIndex });

		expect(excerpt).toBe("Mira Duskwood greeted them warmly.");
	});

	it("returns the whole text when it is a single sentence", () => {
		const text = "Mira Duskwood met the party at the gates.";
		const startIndex = text.indexOf("Mira Duskwood");
		const endIndex = startIndex + "Mira Duskwood".length;

		const excerpt = extractExcerpt(text, { startIndex, endIndex });

		expect(excerpt).toBe("Mira Duskwood met the party at the gates.");
	});
});
