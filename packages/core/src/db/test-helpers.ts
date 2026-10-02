import { createHash, randomBytes } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { mcpOauthService } from "../services/mcp-oauth.service.js";
import { TABLES_IN_DELETE_ORDER } from "./global-setup.js";
import type { Database } from "./index.js";
import * as schema from "./schema/index.js";
import {
	campaignWealth,
	campaigns,
	chunkCorrections,
	chunks,
	conversations,
	encounterMembers,
	encounters,
	entities,
	entityRelationships,
	inventoryItems,
	messages,
	sessionEntities,
	sessions,
	sources,
	writeRequests,
} from "./schema/index.js";
import { resolveLocalTestDbUrl } from "./test-db-url.js";

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
 * Build a unit vector with an *exact* cosine similarity to `basisVector(axis)`
 * (score = 1 - cosine distance, per `.claude/rules/db.md`). Puts the rest of
 * the unit-length budget on `otherAxis` so the vector stays normalized. Use
 * over `mixVectors`-style blending when a test needs a precise, reproducible
 * score rather than an approximate "partially similar."
 */
export function similarityVector(
	axis: number,
	similarity: number,
	otherAxis: number,
	dims = 1024,
): number[] {
	const vec = new Array(dims).fill(0);
	vec[axis] = similarity;
	vec[otherAxis] = Math.sqrt(1 - similarity * similarity);
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
	const connectionString = resolveLocalTestDbUrl();
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
 * Blocks (not races) a concurrent write into any of `TABLES_IN_DELETE_ORDER`
 * while this transaction truncates them. Locked parent-first (reverse of
 * TABLES_IN_DELETE_ORDER) to match how every other test file in this package
 * acquires these same tables' locks (campaign row first, then children) —
 * locking child-first here would instead deadlock against that pattern.
 * Why: Docs/IMPLEMENTATION_NOTES.md § T-060.
 */
export async function lockTruncationTargets(sql: {
	unsafe: (query: string) => Promise<unknown>;
}) {
	const tables = [...TABLES_IN_DELETE_ORDER]
		.reverse()
		.map((table) => `"${table}"`)
		.join(", ");
	await sql.unsafe(`LOCK TABLE ${tables} IN EXCLUSIVE MODE`);
}

/**
 * Deletes a campaign and all rows that reference it (FK-safe order).
 *
 * Prefer this over `ROLLBACK` when tests exercise code that opens its own
 * `db.transaction()` on the same connection — raw `BEGIN` in a test does not
 * compose with Drizzle/postgres.js nested transaction handling.
 */
/**
 * Issues a real access token via the full PKCE authorization-code flow, for
 * tests exercising routes gated behind `requireBearerToken`
 * (`apps/server/src/routes/mcp-http.routes.ts`) — `/mcp`, the upload route,
 * and the conversation-stream route all share this one scheme (T-092).
 */
export async function createAccessToken(db: Database): Promise<string> {
	const client = await mcpOauthService.registerClient(db, {
		redirectUri: "https://claude.ai/api/mcp/callback",
	});
	const codeVerifier = randomBytes(32).toString("base64url");
	const codeChallenge = createHash("sha256")
		.update(codeVerifier)
		.digest("base64url");
	// resource only has to match itself between the two calls below — validateAccessToken never checks it.
	const resource = "http://test.local/mcp";
	const { code } = await mcpOauthService.createAuthorizationCode(db, {
		clientId: client.clientId,
		codeChallenge,
		resource,
	});
	const tokens = await mcpOauthService.exchangeAuthorizationCode(db, {
		code,
		clientId: client.clientId,
		codeVerifier,
		resource,
	});
	return tokens.accessToken;
}

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
	// inventory_items.ownerEntityId FKs to entities — must delete before entities
	// (T-142 review follow-up).
	await db
		.delete(inventoryItems)
		.where(eq(inventoryItems.campaignId, campaignId));
	await db
		.delete(campaignWealth)
		.where(eq(campaignWealth.campaignId, campaignId));
	// encounter_members FKs to both entities and encounters — must clear
	// before either (T-173).
	const encounterRows = await db
		.select({ id: encounters.id })
		.from(encounters)
		.where(eq(encounters.campaignId, campaignId));
	const encounterIds = encounterRows.map((r) => r.id);
	if (encounterIds.length > 0) {
		await db
			.delete(encounterMembers)
			.where(inArray(encounterMembers.encounterId, encounterIds));
	}
	await db.delete(encounters).where(eq(encounters.campaignId, campaignId));
	// entities.sourceId now FKs to sources (T-080) — must delete before sources.
	await db.delete(entities).where(eq(entities.campaignId, campaignId));
	await db.delete(sources).where(eq(sources.campaignId, campaignId));
	await db.delete(sessions).where(eq(sessions.campaignId, campaignId));
	// chunk_corrections FKs to campaigns (T-152) — must clear before it too.
	await db
		.delete(chunkCorrections)
		.where(eq(chunkCorrections.campaignId, campaignId));
	await db.delete(campaigns).where(eq(campaigns.id, campaignId));
}
