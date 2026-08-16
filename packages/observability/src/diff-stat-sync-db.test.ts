import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { testDbUrl } from "@questlog/core/db/test-db-url.js";
import type { UsageArtifact } from "@questlog/core/usage-capture/artifact.js";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres, { type Sql } from "postgres";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { truncateAllTables } from "./db/global-setup.js";
import type {
	GhPrListItem,
	GhPrViewResult,
	GhRunner,
	LedgerEntry,
	LedgerReader,
} from "./diff-stat-sync.js";
import {
	runDiffStatSyncCli,
	syncAllMissingDiffStats,
	syncDiffStatsForTicket,
} from "./diff-stat-sync.js";
import { mapUsageArtifactToTicketRun, upsertTicketRun } from "./ingest.js";
import { ticketReports, ticketRuns } from "./schema/tables.js";

const fixturesDir = fileURLToPath(new URL("./__fixtures__", import.meta.url));

function readFixture(name: string): string {
	return readFileSync(`${fixturesDir}/${name}`, "utf-8");
}

// testDbUrl(), not process.env.DATABASE_URL directly — resolved fresh at
// this module's own top-level evaluation, same reasoning as ingest-db.test.ts
// (Docs/IMPLEMENTATION_NOTES.md § T-052).
const client: Sql = postgres(testDbUrl("questlog_test_observability"), {
	max: 1,
});
const db = drizzle(client, { schema: { ticketRuns, ticketReports } });

async function seedTicketRun(ticketId: string) {
	const artifact = JSON.parse(readFixture("T-999.usage.json")) as UsageArtifact;
	await upsertTicketRun(db, {
		...mapUsageArtifactToTicketRun(artifact),
		ticketId,
	});
}

async function getRow(ticketId: string) {
	const [row] = await db
		.select()
		.from(ticketRuns)
		.where(eq(ticketRuns.ticketId, ticketId));
	return row;
}

/** A fixed merged-PR list + view pair for T-999, keyed by the args gh() was called with. */
function makeGh(overrides?: {
	list?: GhPrListItem[];
	view?: GhPrViewResult;
}): GhRunner {
	const list = overrides?.list ?? [
		{
			number: 321,
			headRefName: "feat/m-obs/t-999-fixture-branch",
			mergedAt: "2026-08-01T00:00:00Z",
		},
	];
	const view = overrides?.view ?? {
		additions: 87,
		deletions: 12,
		changedFiles: 4,
	};
	return vi.fn(async (args: string[]) => {
		if (args[0] === "pr" && args[1] === "list") return list;
		if (args[0] === "pr" && args[1] === "view") return view;
		throw new Error(`unexpected gh invocation: ${args.join(" ")}`);
	});
}

// Every test below drives findMergedPrForTicket's fallback path (the
// branch-search behavior this file already covered) unless it explicitly
// builds its own ledger with an entry — an empty ledger never short-
// circuits `gh pr list`, so this is a no-op stand-in, not a second thing
// under test.
const emptyLedger: LedgerReader = async () => [];

function makeLedger(entries: LedgerEntry[]): LedgerReader {
	return async () => entries;
}

beforeEach(async () => {
	await truncateAllTables(client);
});

afterAll(async () => {
	await client.end();
});

describe("syncDiffStatsForTicket", () => {
	it("upserts the exact expected files_changed/lines_added/lines_removed from a mocked gh pr view response", async () => {
		await seedTicketRun("T-999");
		const gh = makeGh({
			view: { additions: 87, deletions: 12, changedFiles: 4 },
		});

		await syncDiffStatsForTicket(db, "T-999", gh, emptyLedger);

		const row = await getRow("T-999");
		expect(row?.filesChanged).toBe(4);
		expect(row?.linesAdded).toBe(87);
		expect(row?.linesRemoved).toBe(12);
	});

	it("leaves the row's diff-stat fields null and does not error when no matching PR is found", async () => {
		await seedTicketRun("T-999");
		const gh = makeGh({ list: [] });

		await expect(
			syncDiffStatsForTicket(db, "T-999", gh, emptyLedger),
		).resolves.toBeUndefined();

		const row = await getRow("T-999");
		expect(row?.filesChanged).toBeNull();
		expect(row?.linesAdded).toBeNull();
		expect(row?.linesRemoved).toBeNull();
	});

	it("ignores an open (not-yet-merged) PR on a matching branch, leaving the row's diff-stat fields null", async () => {
		await seedTicketRun("T-999");
		const gh = makeGh({
			list: [
				{
					number: 322,
					headRefName: "feat/m-obs/t-999-fixture-branch",
					mergedAt: null,
				},
			],
		});

		await syncDiffStatsForTicket(db, "T-999", gh, emptyLedger);

		const row = await getRow("T-999");
		expect(row?.filesChanged).toBeNull();
	});

	it("resolves the PR number straight from the ledger and never calls gh pr list, when the ticket has a ledger entry", async () => {
		await seedTicketRun("T-999");
		const ledger = makeLedger([
			{
				ticketId: "T-999",
				prNumber: 321,
				branch: "feat/m-obs/t-999-fixture-branch",
				mergedAt: "2026-08-01T00:00:00Z",
			},
		]);
		// No "list" entry at all — a ledger hit must resolve via "pr view"
		// alone; any "pr list" call would throw from makeGh's unexpected-
		// invocation branch instead of silently passing.
		const gh = vi.fn(async (args: string[]) => {
			if (args[0] === "pr" && args[1] === "view" && args[2] === "321") {
				return { additions: 9, deletions: 1, changedFiles: 2 };
			}
			throw new Error(`unexpected gh invocation: ${args.join(" ")}`);
		});

		await syncDiffStatsForTicket(db, "T-999", gh, ledger);

		const row = await getRow("T-999");
		expect(row?.filesChanged).toBe(2);
		expect(row?.linesAdded).toBe(9);
		expect(row?.linesRemoved).toBe(1);
	});

	it("falls back to the branch-search when the ledger has no entry for the ticket", async () => {
		await seedTicketRun("T-999");
		const gh = makeGh({
			view: { additions: 3, deletions: 2, changedFiles: 1 },
		});

		await syncDiffStatsForTicket(db, "T-999", gh, emptyLedger);

		expect(gh).toHaveBeenCalledWith([
			"pr",
			"list",
			"--state",
			"all",
			"--limit",
			"1000",
			"--json",
			"number,headRefName,mergedAt",
		]);
		const row = await getRow("T-999");
		expect(row?.filesChanged).toBe(1);
	});
});

describe("syncAllMissingDiffStats", () => {
	it("given a store with one already-populated row and one null row, only fetches and updates the null one", async () => {
		await seedTicketRun("T-999");
		await seedTicketRun("T-998");
		await db
			.update(ticketRuns)
			.set({ filesChanged: 1, linesAdded: 1, linesRemoved: 1 })
			.where(eq(ticketRuns.ticketId, "T-999"));

		const gh = makeGh({
			list: [
				{
					number: 321,
					headRefName: "feat/m-obs/t-998-fixture-branch",
					mergedAt: "2026-08-01T00:00:00Z",
				},
			],
			view: { additions: 5, deletions: 5, changedFiles: 2 },
		});

		await syncAllMissingDiffStats(db, gh, emptyLedger);

		// Only ever asked gh about the null row's ticket — the already-
		// populated row's branch never matches the mocked list above, so a
		// call for it would have thrown from makeGh's unexpected-invocation
		// branch instead of silently passing.
		expect(gh).toHaveBeenCalledWith([
			"pr",
			"list",
			"--state",
			"all",
			"--limit",
			"1000",
			"--json",
			"number,headRefName,mergedAt",
		]);

		const untouched = await getRow("T-999");
		expect(untouched?.filesChanged).toBe(1);

		const updated = await getRow("T-998");
		expect(updated?.filesChanged).toBe(2);
		expect(updated?.linesAdded).toBe(5);
		expect(updated?.linesRemoved).toBe(5);
	});
});

describe("runDiffStatSyncCli", () => {
	it("syncs a single named ticket id via the CLI entry point", async () => {
		await seedTicketRun("T-999");
		const gh = makeGh();
		// A dedicated connection, not the shared module-scope `db` — the CLI
		// closes whatever connection `loadDb` hands it (`.claude/rules/scripts.md`'s
		// "close the live db singleton" convention), which would otherwise kill
		// every other test in this file sharing the same client.
		const cliClient = postgres(testDbUrl("questlog_test_observability"), {
			max: 1,
		});
		const cliDb = drizzle(cliClient, { schema: { ticketRuns, ticketReports } });
		const loadDb = () => Promise.resolve({ db: cliDb });

		await runDiffStatSyncCli(["T-999"], gh, loadDb, emptyLedger);

		const row = await getRow("T-999");
		expect(row?.filesChanged).toBe(4);
	});
});
