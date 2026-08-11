import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { eq, isNull } from "drizzle-orm";
import type { Database } from "./db/index.js";
import { ticketRuns } from "./schema/tables.js";

const execFileAsync = promisify(execFile);

/**
 * Matches this repo's implementation-branch convention for a ticket —
 * `feat/<milestone-group>/t-###-<slug>` (`Docs/tickets/EXECUTOR_ROUTINE.md`)
 * — so a ticket id like "T-055" matches any PR head branch of that shape
 * regardless of milestone group or slug, without either being known
 * upfront. GitHub's PR search has no head-branch wildcard qualifier, so
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

async function findMergedPrForTicket(
	ticketId: string,
	gh: GhRunner,
): Promise<GhPrListItem | undefined> {
	const pattern = ticketBranchPattern(ticketId);
	const prs = (await gh([
		"pr",
		"list",
		"--state",
		"all",
		"--json",
		"number,headRefName,mergedAt",
	])) as GhPrListItem[];
	return prs.find((pr) => pr.mergedAt !== null && pattern.test(pr.headRefName));
}

/**
 * Looks up a ticket's merged PR (by branch-naming convention, not title —
 * see `ticketBranchPattern`) and upserts its diff stats into that ticket's
 * `ticket_runs` row. When no merged PR is found, the row is left untouched
 * (diff-stat fields stay null) — an unmerged/never-existing PR is an
 * expected outcome here, not an error.
 */
export async function syncDiffStatsForTicket(
	db: Database,
	ticketId: string,
	gh: GhRunner = runGh,
): Promise<void> {
	const pr = await findMergedPrForTicket(ticketId, gh);
	if (!pr) return;

	const view = (await gh([
		"pr",
		"view",
		String(pr.number),
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
): Promise<void> {
	const rows = await db
		.select({ ticketId: ticketRuns.ticketId })
		.from(ticketRuns)
		.where(isNull(ticketRuns.filesChanged));

	for (const row of rows) {
		if (!row.ticketId) continue;
		await syncDiffStatsForTicket(db, row.ticketId, gh);
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
			await syncAllMissingDiffStats(db, gh);
		} else {
			await syncDiffStatsForTicket(db, arg, gh);
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
