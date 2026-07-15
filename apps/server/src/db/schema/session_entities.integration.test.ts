import { eq, sql } from "drizzle-orm";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "../test-helpers.js";
import { campaigns, entities, sessionEntities, sessions } from "./index.js";

const { db, close } = createTestDb();

afterAll(async () => {
	await close();
});

describe("session_entities table", () => {
	beforeEach(async () => {
		await db.execute(sql`BEGIN`);
	});

	afterEach(async () => {
		try {
			await db.execute(sql`ROLLBACK`);
		} catch (err) {
			console.error("Failed to rollback test transaction:", err);
			throw err;
		}
	});

	it("links a session to an entity with a matchType and reads it back", async () => {
		const [campaign] = await db
			.insert(campaigns)
			.values({ name: "Link Test Campaign", theme: "fantasy" })
			.returning();
		if (!campaign) throw new Error("campaign insert failed");

		const [session] = await db
			.insert(sessions)
			.values({ campaignId: campaign.id, sessionNumber: 1, content: "text" })
			.returning();
		if (!session) throw new Error("session insert failed");

		const [entity] = await db
			.insert(entities)
			.values({ campaignId: campaign.id, name: "Mira Duskwood", type: "npc" })
			.returning();
		if (!entity) throw new Error("entity insert failed");

		const rows = await db
			.insert(sessionEntities)
			.values({
				sessionId: session.id,
				entityId: entity.id,
				matchType: "confirmed",
			})
			.returning();
		expect(rows).toHaveLength(1);
		const inserted = rows[0] as (typeof rows)[number];
		expect(inserted.id).toBeDefined();
		expect(inserted.createdAt).toBeInstanceOf(Date);

		const found = await db
			.select()
			.from(sessionEntities)
			.where(eq(sessionEntities.id, inserted.id));
		expect(found).toHaveLength(1);
		expect(found[0]?.sessionId).toBe(session.id);
		expect(found[0]?.entityId).toBe(entity.id);
		expect(found[0]?.matchType).toBe("confirmed");
	});

	it("allows multiple links for the same session with different matchTypes", async () => {
		const [campaign] = await db
			.insert(campaigns)
			.values({ name: "Multi Link Campaign", theme: "fantasy" })
			.returning();
		if (!campaign) throw new Error("campaign insert failed");

		const [session] = await db
			.insert(sessions)
			.values({ campaignId: campaign.id, sessionNumber: 1, content: "text" })
			.returning();
		if (!session) throw new Error("session insert failed");

		const [entityA] = await db
			.insert(entities)
			.values({ campaignId: campaign.id, name: "Entity A", type: "npc" })
			.returning();
		const [entityB] = await db
			.insert(entities)
			.values({ campaignId: campaign.id, name: "Entity B", type: "location" })
			.returning();
		if (!entityA || !entityB) throw new Error("entity insert failed");

		await db.insert(sessionEntities).values([
			{ sessionId: session.id, entityId: entityA.id, matchType: "confirmed" },
			{ sessionId: session.id, entityId: entityB.id, matchType: "ambiguous" },
		]);

		const found = await db
			.select()
			.from(sessionEntities)
			.where(eq(sessionEntities.sessionId, session.id));
		expect(found).toHaveLength(2);
	});
});
