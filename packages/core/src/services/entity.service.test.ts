import { sql } from "drizzle-orm";
import {
	afterAll,
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";
import { chunks, sources } from "../db/schema/index.js";
import {
	basisVector,
	createTestDb,
	deleteCampaignTree,
	similarityVector,
} from "../db/test-helpers.js";
import { NotFoundError } from "../lib/errors.js";
import { campaignService } from "./campaign.service.js";
import { entityService, extractExcerpt } from "./entity.service.js";
import type { FetchFn } from "./voyage.client.js";

const { db, close } = createTestDb();

afterAll(async () => {
	await close();
});

/** Mock fetch that always returns a fixed embedding for the query — decouples createSeeded tests from the Voyage AI API. */
function createMockFetch(embedding: number[]): FetchFn {
	return vi.fn().mockImplementation(async () => ({
		ok: true,
		json: async () => ({ data: [{ embedding, index: 0 }] }),
	})) as unknown as FetchFn;
}

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

	it("excludes an archived entity sharing a name with an active one — only the active entity appears", async () => {
		const active = await insertEntity(campaignId, "Strahd", "npc");
		const archived = await insertEntity(campaignId, "Strahd", "npc");
		await entityService.archive(db, campaignId, archived.id);
		const text = "Strahd loomed over the village";
		const spans = await entityService.detectSpans(db, {
			campaignId,
			text,
			dismissedEntityTexts: [],
		});
		expect(spans).toHaveLength(1);
		expect(spans[0]?.matchType).toBe("confirmed");
		expect(spans[0]?.entityId).toBe(active.id);
		expect(spans[0]?.candidates).toEqual([]);
	});

	it("produces zero spans when the text mentions only an archived entity", async () => {
		const archived = await insertEntity(campaignId, "Strahd", "npc");
		await entityService.archive(db, campaignId, archived.id);
		const text = "Strahd appeared at the gate";
		const spans = await entityService.detectSpans(db, {
			campaignId,
			text,
			dismissedEntityTexts: [],
		});
		expect(spans).toEqual([]);
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

	it("still returns an archived entity's full row, unfiltered", async () => {
		const entity = await insertEntity(campaignId, "Strahd");
		await entityService.archive(db, campaignId, entity.id);
		const found = await entityService.getById(db, campaignId, entity.id);
		expect(found.id).toBe(entity.id);
		expect(found.status).toBe("archived");
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

	it("does not match an archived entity by default", async () => {
		const entity = await insertEntity(campaignId, "Strahd");
		await entityService.archive(db, campaignId, entity.id);
		await expect(
			entityService.getByName(db, campaignId, "Strahd"),
		).rejects.toThrow(NotFoundError);
	});

	it("matches an archived entity when includeArchived is true", async () => {
		const entity = await insertEntity(campaignId, "Strahd");
		await entityService.archive(db, campaignId, entity.id);
		const found = await entityService.getByName(db, campaignId, "Strahd", true);
		expect(found.id).toBe(entity.id);
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

	it("excludes archived entities by default", async () => {
		const active = await insertEntity(campaignId, "Strahd", "npc");
		const archived = await insertEntity(campaignId, "Castle Ravenloft");
		await entityService.archive(db, campaignId, archived.id);

		const results = await entityService.list(db, campaignId);
		expect(results).toHaveLength(1);
		expect(results[0]?.id).toBe(active.id);
	});

	it("includes archived entities when includeArchived is true", async () => {
		const active = await insertEntity(campaignId, "Strahd", "npc");
		const archived = await insertEntity(campaignId, "Castle Ravenloft");
		await entityService.archive(db, campaignId, archived.id);

		const results = await entityService.list(db, campaignId, undefined, true);
		expect(results).toHaveLength(2);
		expect(results.map((r) => r.id).sort()).toEqual(
			[active.id, archived.id].sort(),
		);
	});
});

describe("entityService.archive / unarchive", () => {
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

	it("sets status to archived, scoped to the campaign", async () => {
		const entity = await insertEntity(campaignId, "Strahd");
		const archived = await entityService.archive(db, campaignId, entity.id);
		expect(archived.status).toBe("archived");
	});

	it("throws NotFoundError archiving a bogus entityId", async () => {
		await expect(
			entityService.archive(
				db,
				campaignId,
				"00000000-0000-0000-0000-000000000000",
			),
		).rejects.toThrow(NotFoundError);
	});

	it("throws NotFoundError archiving an entity from a different campaign", async () => {
		const otherCampaign = await campaignService.create(db, {
			name: "Other Campaign",
			theme: "fantasy",
		});
		const entity = await insertEntity(otherCampaign.id, "Strahd");
		await expect(
			entityService.archive(db, campaignId, entity.id),
		).rejects.toThrow(NotFoundError);
	});

	it("sets status back to active", async () => {
		const entity = await insertEntity(campaignId, "Strahd");
		await entityService.archive(db, campaignId, entity.id);
		const unarchived = await entityService.unarchive(db, campaignId, entity.id);
		expect(unarchived.status).toBe("active");
	});

	it("throws NotFoundError unarchiving a bogus entityId", async () => {
		await expect(
			entityService.unarchive(
				db,
				campaignId,
				"00000000-0000-0000-0000-000000000000",
			),
		).rejects.toThrow(NotFoundError);
	});

	it("leaves other entities/campaigns untouched", async () => {
		const target = await insertEntity(campaignId, "Strahd");
		const other = await insertEntity(campaignId, "Ireena");
		await entityService.archive(db, campaignId, target.id);

		const untouched = await entityService.getById(db, campaignId, other.id);
		expect(untouched.status).toBe("active");
	});
});

describe("entityService.create", () => {
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

	it("stores the given attributes on the entity", async () => {
		const entity = await entityService.create(db, {
			campaignId,
			name: "Vespera Nightveil",
			type: "npc",
			attributes: { extractedFrom: "00000000-0000-0000-0000-000000000000" },
		});

		expect(entity.attributes).toEqual({
			extractedFrom: "00000000-0000-0000-0000-000000000000",
		});
	});

	it("defaults attributes to an empty object when omitted", async () => {
		const entity = await entityService.create(db, {
			campaignId,
			name: "Ismark",
			type: "npc",
		});

		expect(entity.attributes).toEqual({});
	});
});

describe("entityService.createSeeded", () => {
	// contextService.searchChunks' keywordSearch opens its own db.transaction()
	// (T-015) — doesn't compose with a raw BEGIN/ROLLBACK wrapper on the same
	// connection (.claude/rules/backend.md "Test DB pattern"); use explicit
	// FK-safe cleanup instead, same as context.service.test.ts.
	let campaignId: string;
	let sourceId: string;

	beforeEach(async () => {
		const campaign = await campaignService.create(db, {
			name: "Test Campaign",
			theme: "fantasy",
		});
		campaignId = campaign.id;

		const [source] = await db
			.insert(sources)
			.values({ campaignId, name: "primer.md", type: "file", status: "done" })
			.returning();
		sourceId = source?.id ?? "";
	});

	afterEach(async () => {
		await deleteCampaignTree(db, campaignId);
	});

	it("seeds description and attributes.seededFrom when a chunk clears the threshold", async () => {
		const [chunk] = await db
			.insert(chunks)
			.values({
				campaignId,
				sourceId,
				content: "Mira Duskwood patrols the Old Road near Ashfall Peak.",
				embedding: basisVector(0),
				metadata: { position: 0 },
			})
			.returning();

		const result = await entityService.createSeeded(db, {
			campaignId,
			name: "Mira Duskwood",
			type: "npc",
			fetchFn: createMockFetch(basisVector(0)),
		});

		expect(result.seeded).toBe(true);
		expect(result.entity.description).toContain(
			"Mira Duskwood patrols the Old Road",
		);
		expect(result.entity.attributes).toMatchObject({
			seededFrom: { chunkIds: [chunk?.id], confidence: expect.any(Number) },
		});
		expect(result.citations).toEqual(
			expect.arrayContaining([expect.objectContaining({ chunkId: chunk?.id })]),
		);
		expect(result.confidence).toBeGreaterThan(0);
	});

	it("appends the seeded draft after a caller-supplied description rather than replacing it", async () => {
		await db.insert(chunks).values({
			campaignId,
			sourceId,
			content: "Mira Duskwood patrols the Old Road near Ashfall Peak.",
			embedding: basisVector(0),
			metadata: { position: 0 },
		});

		const result = await entityService.createSeeded(db, {
			campaignId,
			name: "Mira Duskwood",
			type: "npc",
			description: "A grizzled road warden.",
			fetchFn: createMockFetch(basisVector(0)),
		});

		expect(
			result.entity.description?.startsWith("A grizzled road warden."),
		).toBe(true);
		expect(result.entity.description).toContain("Seeded from lore:");
		expect(result.entity.description).toContain(
			"Mira Duskwood patrols the Old Road",
		);
	});

	it("does not seed when the best match is below threshold, but still returns it as a citation", async () => {
		const [chunk] = await db
			.insert(chunks)
			.values({
				campaignId,
				sourceId,
				content: "The tavern serves watered-down ale.",
				// Orthogonal to the query embedding (basisVector(0)) -> score 0.
				embedding: basisVector(1),
				metadata: { position: 0 },
			})
			.returning();

		const result = await entityService.createSeeded(db, {
			campaignId,
			name: "Mira Duskwood",
			type: "npc",
			fetchFn: createMockFetch(basisVector(0)),
		});

		expect(result.seeded).toBe(false);
		expect(result.entity.description).toBeNull();
		expect(result.entity.attributes).toEqual({});
		expect(result.citations).toEqual(
			expect.arrayContaining([expect.objectContaining({ chunkId: chunk?.id })]),
		);
	});

	it("leaves the description unset when no lore matches at all", async () => {
		const result = await entityService.createSeeded(db, {
			campaignId,
			name: "Mira Duskwood",
			type: "npc",
			fetchFn: createMockFetch(basisVector(0)),
		});

		expect(result.seeded).toBe(false);
		expect(result.entity.description).toBeNull();
		expect(result.citations).toEqual([]);
		expect(result.confidence).toBe(0);
	});

	it("lists each source's excerpt separately when matches span more than one source", async () => {
		const [source2] = await db
			.insert(sources)
			.values({ campaignId, name: "second.md", type: "file", status: "done" })
			.returning();

		await db.insert(chunks).values([
			{
				campaignId,
				sourceId,
				content: "Mira Duskwood patrols the Old Road.",
				embedding: basisVector(0),
				metadata: { position: 0 },
			},
			{
				campaignId,
				sourceId: source2?.id,
				content: "Mira Duskwood once served in the Ashfall Watch.",
				embedding: basisVector(0),
				metadata: { position: 0 },
			},
		]);

		const result = await entityService.createSeeded(db, {
			campaignId,
			name: "Mira Duskwood",
			type: "npc",
			fetchFn: createMockFetch(basisVector(0)),
		});

		expect(result.entity.description).toContain("Old Road");
		expect(result.entity.description).toContain("Ashfall Watch");
		expect(result.entity.description).toContain("primer.md");
		expect(result.entity.description).toContain("second.md");
	});

	it("seeds from the highest-scoring chunk even when a more recent, lower-scoring chunk ranks first by combinedScore", async () => {
		// searchChunks sorts by combinedScore (recency-blended), not raw score.
		// An older chunk clearing the threshold on raw score can rank behind a
		// newer, sub-threshold chunk — the gate must scan all results for the
		// max raw score, not just trust array position 0.
		// Content deliberately avoids the query's tokens (the entity's name and
		// type) so pg_trgm's keyword-search leg doesn't also match and boost
		// these chunks (`dualMatchBoost`) — this test isolates vector score only.
		await db.insert(chunks).values([
			{
				campaignId,
				sourceId,
				content: "A road warden patrols alone near the old bridge at dusk.",
				embedding: similarityVector(0, 0.72, 1),
				metadata: { position: 0 },
				createdAt: new Date("2020-01-01T00:00:00Z"),
			},
			{
				campaignId,
				sourceId,
				content: "An officer was seen recently, otherwise unremarkable.",
				embedding: similarityVector(0, 0.69, 2),
				metadata: { position: 1 },
				createdAt: new Date(),
			},
		]);

		const result = await entityService.createSeeded(db, {
			campaignId,
			name: "Mira Duskwood",
			type: "npc",
			fetchFn: createMockFetch(basisVector(0)),
		});

		expect(result.seeded).toBe(true);
		expect(result.confidence).toBeCloseTo(0.72, 1);
		expect(result.entity.description).toContain("road warden");
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

describe("entityService.detectCandidates", () => {
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

	it("proposes an NPC candidate from an unrecognized proper noun in an NPC-shaped sentence", async () => {
		const text = "The party met Vespera Nightveil at the gates.";
		const candidates = await entityService.detectCandidates(db, {
			campaignId,
			text,
		});

		const vespera = candidates.find((c) => c.name === "Vespera Nightveil");
		expect(vespera).toBeDefined();
		expect(vespera?.entityType).toBe("npc");
		expect(vespera?.description.length).toBeGreaterThan(0);
		expect(vespera?.description).toContain("Vespera Nightveil");
		expect(vespera?.startIndex).toBe(text.indexOf("Vespera Nightveil"));
		expect(vespera?.endIndex).toBe(
			text.indexOf("Vespera Nightveil") + "Vespera Nightveil".length,
		);
	});

	it("returns zero candidates when every proper noun is already covered by detectSpans", async () => {
		await insertEntity(campaignId, "Strahd", "npc");
		await insertEntity(campaignId, "Castle Ravenloft", "location");
		const text = "Strahd rules from Castle Ravenloft.";
		const candidates = await entityService.detectCandidates(db, {
			campaignId,
			text,
		});
		expect(candidates).toEqual([]);
	});

	it("collapses repeated mentions of the same new name into a single candidate", async () => {
		const text =
			"The party met Vespera Nightveil at dawn. Later, Vespera Nightveil wielded a dagger.";
		const candidates = await entityService.detectCandidates(db, {
			campaignId,
			text,
		});

		const matches = candidates.filter((c) => c.name === "Vespera Nightveil");
		expect(matches).toHaveLength(1);
		expect(matches[0]?.startIndex).toBe(text.indexOf("Vespera Nightveil"));
	});

	it("proposes one candidate of each ENTITY_TYPES value from fixture text", async () => {
		const text = [
			"The party met Vespera Nightveil at dawn.",
			"They traveled to Castle Ravenloft by nightfall.",
			"They joined the Ironfang Clan thereafter.",
			"Vespera Nightveil wielded the Sunblade of Ashara.",
			"This began the Shadow Prophecy in earnest.",
		].join(" ");

		const candidates = await entityService.detectCandidates(db, {
			campaignId,
			text,
		});

		const byType = Object.fromEntries(
			candidates.map((c) => [c.entityType, c]),
		) as Record<string, (typeof candidates)[number]>;

		expect(byType.npc?.name).toMatch(/Vespera/);
		expect(byType.location?.name).toMatch(/Ravenloft|Castle/);
		expect(byType.faction?.name).toMatch(/Ironfang|Clan/);
		expect(byType.item?.name).toMatch(/Sunblade|Ashara/);
		expect(byType.arc?.name).toMatch(/Shadow|Prophecy/);

		for (const candidate of candidates) {
			expect(candidate.description.length).toBeGreaterThan(0);
			expect(candidate.startIndex).toBeGreaterThanOrEqual(0);
			expect(candidate.endIndex).toBeGreaterThan(candidate.startIndex);
			expect(text.slice(candidate.startIndex, candidate.endIndex)).toBe(
				candidate.name,
			);
		}
	});
});
