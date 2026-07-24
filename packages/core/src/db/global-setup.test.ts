import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { setup, truncateAllTables } from "./global-setup.js";
import { FAKE_HOSTED_DB_URL } from "./test-db-url.js";
import { createTestDb } from "./test-helpers.js";

class RollbackForTest extends Error {}

describe("setup", () => {
	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it("refuses a prod-shaped DATABASE_URL (hosted Neon branch) instead of truncating tables against it", async () => {
		vi.stubEnv("DATABASE_URL", FAKE_HOSTED_DB_URL);

		await expect(setup()).rejects.toThrow(/non-local database host/);
	});
});

describe("global-setup", () => {
	const { client, close } = createTestDb();

	afterAll(async () => {
		await close();
	});

	it("cleans up an orphaned write_requests row instead of throwing an FK violation on campaigns", async () => {
		// Runs inside BEGIN/ROLLBACK (forced by throwing RollbackForTest below)
		// so the real truncation never commits — safe under Vitest's default
		// file-level parallelism, since other concurrently-running test files
		// never observe these deletes. Uses tx.unsafe() with bound parameters
		// (not tagged templates) because TypeScript's Omit — used to derive
		// TransactionSql from Sql — drops call signatures, so `tx`\`...\` alone
		// doesn't typecheck even though it works at runtime.
		await expect(
			client.begin(async (tx) => {
				const campaignRows = await tx.unsafe<{ id: string }[]>(
					"INSERT INTO campaigns (name, theme) VALUES ($1, $2) RETURNING id",
					["Orphan Test Campaign", "fantasy"],
				);
				const campaignId = (campaignRows[0] as { id: string }).id;
				await tx.unsafe(
					`INSERT INTO write_requests (campaign_id, tool_name, payload, expires_at)
					 VALUES ($1, $2, $3::jsonb, now() + interval '15 minutes')`,
					[campaignId, "log_session", "{}"],
				);

				await expect(truncateAllTables(tx)).resolves.not.toThrow();

				const campaignCountRows = await tx.unsafe<{ count: number }[]>(
					"SELECT count(*)::int AS count FROM campaigns WHERE id = $1",
					[campaignId],
				);
				const writeRequestCountRows = await tx.unsafe<{ count: number }[]>(
					"SELECT count(*)::int AS count FROM write_requests WHERE campaign_id = $1",
					[campaignId],
				);
				expect((campaignCountRows[0] as { count: number }).count).toBe(0);
				expect((writeRequestCountRows[0] as { count: number }).count).toBe(0);

				throw new RollbackForTest();
			}),
		).rejects.toThrow(RollbackForTest);
	});

	it("cleans up an orphaned session_entities row instead of throwing an FK violation on entities/sessions", async () => {
		await expect(
			client.begin(async (tx) => {
				const campaignRows = await tx.unsafe<{ id: string }[]>(
					"INSERT INTO campaigns (name, theme) VALUES ($1, $2) RETURNING id",
					["Orphan Link Test Campaign", "fantasy"],
				);
				const campaignId = (campaignRows[0] as { id: string }).id;

				const sessionRows = await tx.unsafe<{ id: string }[]>(
					`INSERT INTO sessions (campaign_id, session_number, content)
					 VALUES ($1, $2, $3) RETURNING id`,
					[campaignId, 1, "text"],
				);
				const sessionId = (sessionRows[0] as { id: string }).id;

				const entityRows = await tx.unsafe<{ id: string }[]>(
					`INSERT INTO entities (campaign_id, name, type)
					 VALUES ($1, $2, $3) RETURNING id`,
					[campaignId, "Orphan Entity", "npc"],
				);
				const entityId = (entityRows[0] as { id: string }).id;

				await tx.unsafe(
					`INSERT INTO session_entities (session_id, entity_id, match_type)
					 VALUES ($1, $2, $3)`,
					[sessionId, entityId, "confirmed"],
				);

				await expect(truncateAllTables(tx)).resolves.not.toThrow();

				const linkCountRows = await tx.unsafe<{ count: number }[]>(
					"SELECT count(*)::int AS count FROM session_entities WHERE session_id = $1",
					[sessionId],
				);
				expect((linkCountRows[0] as { count: number }).count).toBe(0);

				throw new RollbackForTest();
			}),
		).rejects.toThrow(RollbackForTest);
	});

	it("does not silently skip the rest of the delete order when a single table is missing (vs. the whole database being missing)", async () => {
		await expect(
			client.begin(async (tx) => {
				await tx.unsafe(
					"ALTER TABLE write_requests RENAME TO write_requests_renamed_for_test",
				);

				await expect(truncateAllTables(tx)).rejects.toThrow(
					/relation "write_requests" does not exist/,
				);

				throw new RollbackForTest();
			}),
		).rejects.toThrow(RollbackForTest);
	});
});
