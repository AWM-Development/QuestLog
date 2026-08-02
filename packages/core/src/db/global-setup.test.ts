import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import type { TestProject } from "vitest/node";
import {
	TABLES_IN_DELETE_ORDER,
	setup,
	truncateAllTables,
} from "./global-setup.js";
import { FAKE_HOSTED_DB_URL, testDbUrl } from "./test-db-url.js";
import { createTestDb, lockTruncationTargets } from "./test-helpers.js";

class RollbackForTest extends Error {}

describe("setup", () => {
	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it("refuses a prod-shaped DATABASE_URL (hosted Neon branch) instead of truncating tables against it", async () => {
		vi.stubEnv("DATABASE_URL", FAKE_HOSTED_DB_URL);

		await expect(setup()).rejects.toThrow(/non-local database host/);
	});

	it("resolves the target database from the TestProject's own config, not process.env — Vitest applies test.env to process.env after globalSetup runs, so relying on process.env here truncates the wrong database", async () => {
		vi.stubEnv("DATABASE_URL", testDbUrl("questlog_test"));
		const fakeProject = {
			config: { env: { DATABASE_URL: FAKE_HOSTED_DB_URL } },
		} as unknown as TestProject;

		await expect(setup(fakeProject)).rejects.toThrow(/non-local database host/);
	});
});

describe("global-setup", () => {
	const { client, close } = createTestDb();

	afterAll(async () => {
		await close();
	});

	it("cleans up an orphaned write_requests row instead of throwing an FK violation on campaigns", async () => {
		// Runs inside BEGIN/ROLLBACK (forced by throwing RollbackForTest below)
		// so the real truncation never commits, and the explicit lock below
		// blocks (rather than races) any concurrently-running test file that
		// commits a referencing row mid-truncation — see lockTruncationTargets'
		// definition in test-helpers.ts for the FK-violation race this guards
		// against. Uses tx.unsafe() with bound parameters (not tagged
		// templates) because TypeScript's
		// Omit — used to derive TransactionSql from Sql — drops call signatures,
		// so `tx`\`...\` alone doesn't typecheck even though it works at runtime.
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

				await lockTruncationTargets(tx);
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

				await lockTruncationTargets(tx);
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

	it("blocks (rather than races) a concurrent insert into a referencing table while truncating", async () => {
		const race = createTestDb();
		let racePromise: Promise<number> | undefined;
		const sourcesIndex = TABLES_IN_DELETE_ORDER.indexOf("sources");

		try {
			await expect(
				client.begin(async (tx) => {
					await tx.unsafe(
						"INSERT INTO campaigns (name, theme) VALUES ($1, $2) RETURNING id",
						["Lock Test Campaign", "fantasy"],
					);

					await lockTruncationTargets(tx);

					// Walk the delete order in two phases instead of one atomic
					// truncateAllTables(tx) call, so the concurrent insert below
					// lands deterministically in the exact window that produced
					// the production flake: after "sources" is cleared but before
					// "campaigns" is (Docs/tickets/T-060-fix-global-setup-truncate-race.md).
					for (let i = 0; i <= sourcesIndex; i++) {
						await tx.unsafe(`DELETE FROM "${TABLES_IN_DELETE_ORDER[i]}"`);
					}

					// Deliberately not awaited: with the lock held, this can't
					// complete until this transaction ends, so awaiting it here
					// would deadlock this transaction against itself.
					racePromise = (async () => {
						const start = Date.now();
						const otherCampaignRows = await race.client.unsafe<
							{ id: string }[]
						>(
							"INSERT INTO campaigns (name, theme) VALUES ($1, $2) RETURNING id",
							["Concurrent Campaign", "fantasy"],
						);
						const otherCampaignId = (otherCampaignRows[0] as { id: string }).id;
						await race.client.unsafe(
							"INSERT INTO sources (campaign_id, name, type, status) VALUES ($1, $2, $3, $4)",
							[otherCampaignId, "race.txt", "text", "ready"],
						);
						return Date.now() - start;
					})();

					// Give the concurrent insert a moment to actually attempt (and,
					// with the lock held, block).
					await new Promise((resolve) => setTimeout(resolve, 300));

					for (
						let i = sourcesIndex + 1;
						i < TABLES_IN_DELETE_ORDER.length;
						i++
					) {
						await tx.unsafe(`DELETE FROM "${TABLES_IN_DELETE_ORDER[i]}"`);
					}

					throw new RollbackForTest();
				}),
			).rejects.toThrow(RollbackForTest);

			const elapsedMs = await racePromise;
			// Proves the insert was actually blocked by the lock, not just fast —
			// it only completes once the transaction above rolls back and releases it.
			expect(elapsedMs).toBeGreaterThanOrEqual(250);
		} finally {
			await race.close();
		}
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
