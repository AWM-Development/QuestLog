import { execFile, execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";
import { eq, isNull } from "drizzle-orm";
import type { Database } from "./db/index.js";
import { ticketRuns } from "./schema/tables.js";

const execFileAsync = promisify(execFile);

/**
 * Fallback-only: matches this repo's implementation-branch convention for a
 * ticket — `feat/<milestone-group>/t-###-<slug>` (`Docs/tickets/EXECUTOR_ROUTINE.md`)
 * — so a ticket id like "T-055" matches any PR head branch of that shape
 * regardless of milestone group or slug, without either being known
 * upfront. Only used when `findMergedPrForTicket` gets a ledger miss (see
 * below) — GitHub's PR search has no head-branch wildcard qualifier, so
 * this pattern is applied client-side against a listed PR's `headRefName`
 * rather than passed to `gh` as a `--search` string.
 */
export function ticketBranchPattern(ticketId: string): RegExp {
	const escaped = ticketId.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	return new RegExp(`^feat/[^/]+/${escaped}-`);
}

export interface GhPrListItem {
	number: number;
	headRefName: string;
	mergedAt: string | null;
}

export interface GhPrViewResult {
	additions: number;
	deletions: number;
	changedFiles: number;
}

export interface DiffStats {
	filesChanged: number;
	linesAdded: number;
	linesRemoved: number;
}

/** Maps a `gh pr view --json additions,deletions,changedFiles` response to the three `ticket_runs` diff-stat columns. */
export function mapPrViewToDiffStats(pr: GhPrViewResult): DiffStats {
	return {
		filesChanged: pr.changedFiles,
		linesAdded: pr.additions,
		linesRemoved: pr.deletions,
	};
}

/** Runs the `gh` CLI and parses its stdout as JSON — injected everywhere below so tests never shell out for real. */
export type GhRunner = (args: string[]) => Promise<unknown>;

export const runGh: GhRunner = async (args) => {
	const { stdout } = await execFileAsync("gh", args);
	return JSON.parse(stdout);
};

export interface LedgerEntry {
	ticketId: string;
	prNumber: number;
	branch: string;
	mergedAt: string;
}

/** Reads and parses `Docs/tickets/.merge-ledger.json` — injected so tests never touch the real repo file. */
export type LedgerReader = () => Promise<LedgerEntry[]>;

/**
 * `ticket-status-ledger.yml` (T-116) already records `{ticketId, prNumber}`
 * for every ticket merged since it shipped (2026-08-03) — built for the
 * same "find this ticket's PR without scanning GitHub's full history"
 * problem this file has. Reading it is an O(1) lookup against a known-good
 * mapping instead of a `gh pr list` search, so it's tried first. An absent
 * file (fresh checkout before any post-T-116 merge) reads as "no entries",
 * same as the ledger workflow's own empty-array start state — not an error.
 */
export const readLedger: LedgerReader = async () => {
	const repoRoot = execFileSync("git", ["rev-parse", "--show-toplevel"], {
		encoding: "utf-8",
	}).trim();
	try {
		const raw = await readFile(
			`${repoRoot}/Docs/tickets/.merge-ledger.json`,
			"utf-8",
		);
		return JSON.parse(raw) as LedgerEntry[];
	} catch (err) {
		if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
		throw err;
	}
};

/**
 * Resolves a ticket's merged PR number. Tries the ledger first (see
 * `readLedger`); falls back to a branch-naming-convention search via `gh
 * pr list` only for tickets the ledger doesn't cover — by design, every
 * ticket merged before T-116 shipped (`Docs/IMPLEMENTATION_NOTES.md` § T-116
 * documents no historical backfill). `--limit 1000`: `gh pr list` defaults
 * to 30, which silently truncated this search against this repo's 280+ PRs
 * before this fix — a ticket outside the default window read as "no PR
 * found" indistinguishably from a genuinely unmerged one.
 */
async function findMergedPrForTicket(
	ticketId: string,
	gh: GhRunner,
	ledger: LedgerReader,
): Promise<number | undefined> {
	const entries = await ledger();
	const ledgerHit = entries.find((entry) => entry.ticketId === ticketId);
	if (ledgerHit) return ledgerHit.prNumber;

	const pattern = ticketBranchPattern(ticketId);
	const prs = (await gh([
		"pr",
		"list",
		"--state",
		"all",
		"--limit",
		"1000",
		"--json",
		"number,headRefName,mergedAt",
	])) as GhPrListItem[];
	return prs.find((pr) => pr.mergedAt !== null && pattern.test(pr.headRefName))
		?.number;
}

/**
 * Looks up a ticket's merged PR (see `findMergedPrForTicket`) and writes
 * its diff stats into that ticket's existing `ticket_runs` row (an
 * `UPDATE`, not an insert-on-missing upsert like `ingest.ts`'s
 * `upsertTicketRun` — this only ever runs after ingestion has already
 * created the row). When no merged PR is found, the row is left untouched
 * (diff-stat fields stay null) — an unmerged/never-existing PR is an
 * expected outcome here, not an error.
 */
export async function syncDiffStatsForTicket(
	db: Database,
	ticketId: string,
	gh: GhRunner = runGh,
	ledger: LedgerReader = readLedger,
): Promise<void> {
	const prNumber = await findMergedPrForTicket(ticketId, gh, ledger);
	if (!prNumber) return;

	const view = (await gh([
		"pr",
		"view",
		String(prNumber),
		"--json",
		"additions,deletions,changedFiles",
	])) as GhPrViewResult;

	await db
		.update(ticketRuns)
		.set(mapPrViewToDiffStats(view))
		.where(eq(ticketRuns.ticketId, ticketId));
}

/**
 * Syncs diff stats for every `ticket_runs` row missing them. A null
 * `filesChanged` is the signal a row hasn't been synced yet — all three
 * diff-stat fields are always written together (`mapPrViewToDiffStats`), so
 * checking this one column is sufficient. Rows with no `ticketId` (empty
 * runs, T-046) are skipped — there's no PR to look up for those.
 */
export async function syncAllMissingDiffStats(
	db: Database,
	gh: GhRunner = runGh,
	ledger: LedgerReader = readLedger,
): Promise<void> {
	const rows = await db
		.select({ ticketId: ticketRuns.ticketId })
		.from(ticketRuns)
		.where(isNull(ticketRuns.filesChanged));

	for (const row of rows) {
		if (!row.ticketId) continue;
		await syncDiffStatsForTicket(db, row.ticketId, gh, ledger);
	}
}

/**
 * The guarded entry block's logic, factored out so it's testable without
 * running this file as a script (`.claude/rules/scripts.md`'s dual-mode
 * shape). `loadDb` is injected the same way `cli.ts`'s `runIngestCli` does.
 */
export async function runDiffStatSyncCli(
	argv: string[],
	gh: GhRunner = runGh,
	loadDb: () => Promise<{ db: Database }> = () => import("./db/index.js"),
	ledger: LedgerReader = readLedger,
): Promise<void> {
	const arg = argv[0];
	if (!arg) {
		console.error("Usage: tsx src/diff-stat-sync.ts <T-###|all>");
		process.exitCode = 1;
		return;
	}

	const { db } = await loadDb();
	try {
		if (arg === "all") {
			await syncAllMissingDiffStats(db, gh, ledger);
		} else {
			await syncDiffStatsForTicket(db, arg, gh, ledger);
		}
		console.log(`Synced diff stats for ${arg}`);
	} finally {
		await db.$client.end().catch(() => {});
	}
}

if (import.meta.url === `file://${process.argv[1]}`) {
	runDiffStatSyncCli(process.argv.slice(2)).catch((err) => {
		console.error("Unexpected diff-stat sync CLI error:", err);
		process.exitCode = 1;
	});
}
