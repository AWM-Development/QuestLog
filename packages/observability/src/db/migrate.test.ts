import { readFileSync } from "node:fs";
import { testDbUrl } from "@questlog/core/db/test-db-url.js";
import postgres, { type Sql } from "postgres";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { truncateAllTables } from "./global-setup.js";
import { migrationsFolder } from "./migrate.js";

// T-108: the `runner` column's migration (0002_lowly_black_cat.sql) ships an
// ADD COLUMN plus a backfill UPDATE for rows that predate the column — every
// row ingested before this ticket came from a Claude Code run. This suite's
// shared test DB already has the migration applied (bootstrap runs
// db:migrate once), so re-running the whole file would fail on the
// already-applied ADD COLUMN. Instead it reads the migration's own backfill
// statement straight off disk and re-executes just that — proving the exact
// SQL shipped in the migration is what does the backfilling, not a
// hand-duplicated copy of it that could silently drift from the real file.
const client: Sql = postgres(testDbUrl("questlog_test_observability"), {
	max: 1,
});

function readBackfillStatement(): string {
	const sql = readFileSync(
		`${migrationsFolder}/0002_lowly_black_cat.sql`,
		"utf-8",
	);
	const statements = sql.split("--> statement-breakpoint");
	const backfill = statements.find((s) => /^UPDATE /m.test(s));
	if (!backfill) {
		throw new Error(
			"0002_lowly_black_cat.sql has no UPDATE backfill statement",
		);
	}
	return backfill.trim();
}

beforeEach(async () => {
	await truncateAllTables(client);
});

afterAll(async () => {
	await client.end();
});

describe("0002_lowly_black_cat.sql backfill (T-108)", () => {
	it("backfills every pre-existing NULL runner to 'claude-code'", async () => {
		// Simulates a row ingested before this migration: inserted with every
		// NOT NULL column satisfied, `runner` left unset (NULL at the DB level).
		await client`
			INSERT INTO ticket_runs (
				ticket_id, empty_run, session_id, input_tokens, output_tokens,
				cache_creation_input_tokens, cache_read_input_tokens, duration_ms,
				turn_count, applies_rate, theoretical_cost_intro_usd,
				theoretical_cost_standard_usd, total_system_cost_intro_usd,
				total_system_cost_standard_usd
			) VALUES (
				'T-997', false, 'pre-migration-session', 1, 2,
				3, 4, 5,
				6, 'intro', 1.0,
				1.5, 1.0,
				1.5
			)
		`;

		const [beforeBackfill] = await client`
			SELECT runner FROM ticket_runs WHERE ticket_id = 'T-997'
		`;
		expect(beforeBackfill?.runner).toBeNull();

		await client.unsafe(readBackfillStatement());

		const [afterBackfill] = await client`
			SELECT runner FROM ticket_runs WHERE ticket_id = 'T-997'
		`;
		expect(afterBackfill?.runner).toBe("claude-code");
	});

	it("leaves an already-populated runner untouched", async () => {
		await client`
			INSERT INTO ticket_runs (
				ticket_id, runner, empty_run, session_id, input_tokens, output_tokens,
				cache_creation_input_tokens, cache_read_input_tokens, duration_ms,
				turn_count, applies_rate, theoretical_cost_intro_usd,
				theoretical_cost_standard_usd, total_system_cost_intro_usd,
				total_system_cost_standard_usd
			) VALUES (
				'T-996', 'devin', false, 'already-populated-session', 1, 2,
				3, 4, 5,
				6, 'intro', 1.0,
				1.5, 1.0,
				1.5
			)
		`;

		await client.unsafe(readBackfillStatement());

		const [row] = await client`
			SELECT runner FROM ticket_runs WHERE ticket_id = 'T-996'
		`;
		expect(row?.runner).toBe("devin");
	});
});
