import { eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import type { Database } from "./index.js";
import * as schema from "./schema/index.js";
import {
	campaigns,
	chunks,
	conversations,
	entities,
	entityRelationships,
	messages,
	sessionEntities,
	sessions,
	sources,
	writeRequests,
} from "./schema/index.js";
import { testDbUrl } from "./test-db-url.js";

/**
 * Build a unit vector along a single axis.
 * All vectors along the same axis have cosine similarity 1.0 with each other.
 */
export function basisVector(axis: number, dims = 1024): number[] {
	const vec = new Array(dims).fill(0);
	vec[axis] = 1;
	return vec;
}

/**
 * Creates an isolated test database connection.
 *
 * Defaults to { max: 1 } so all queries within a test share the same
 * connection. Pass { max } to override — e.g. a dedicated multi-connection
 * client for tests that need to observe genuine cross-connection behavior.
 *
 * Pair with `BEGIN` / `ROLLBACK` in beforeEach/afterEach for isolation **unless**
 * the code under test calls `db.transaction()` (e.g. conversation chat): a second
 * `BEGIN` on that connection triggers PostgreSQL warnings. For those suites, use
 * {@link deleteCampaignTree} (or similar explicit cleanup) instead of an outer
 * transaction.
 *
 * Call close() in afterAll to release the connection.
 */
export function createTestDb(options?: { max?: number }) {
	const connectionString =
		process.env.DATABASE_URL ?? testDbUrl("questlog_test");
	const client = postgres(connectionString, {
		max: options?.max ?? 1,
		idle_timeout: 10,
	});
	const db = drizzle(client, { schema });

	return {
		db,
		client,
		close: () => client.end(),
	};
}

/**
 * Deletes a campaign and all rows that reference it (FK-safe order).
 *
 * Prefer this over `ROLLBACK` when tests exercise code that opens its own
 * `db.transaction()` on the same connection — raw `BEGIN` in a test does not
 * compose with Drizzle/postgres.js nested transaction handling.
 */
export async function deleteCampaignTree(db: Database, campaignId: string) {
	const convRows = await db
		.select({ id: conversations.id })
		.from(conversations)
		.where(eq(conversations.campaignId, campaignId));
	const convIds = convRows.map((r) => r.id);
	if (convIds.length > 0) {
		await db.delete(messages).where(inArray(messages.conversationId, convIds));
	}
	await db
		.delete(conversations)
		.where(eq(conversations.campaignId, campaignId));
	await db.delete(chunks).where(eq(chunks.campaignId, campaignId));
	await db.delete(sources).where(eq(sources.campaignId, campaignId));
	await db
		.delete(writeRequests)
		.where(eq(writeRequests.campaignId, campaignId));
	await db
		.delete(entityRelationships)
		.where(eq(entityRelationships.campaignId, campaignId));
	const sessionRows = await db
		.select({ id: sessions.id })
		.from(sessions)
		.where(eq(sessions.campaignId, campaignId));
	const sessionIds = sessionRows.map((r) => r.id);
	if (sessionIds.length > 0) {
		await db
			.delete(sessionEntities)
			.where(inArray(sessionEntities.sessionId, sessionIds));
	}
	await db.delete(entities).where(eq(entities.campaignId, campaignId));
	await db.delete(sessions).where(eq(sessions.campaignId, campaignId));
	await db.delete(campaigns).where(eq(campaigns.id, campaignId));
}
