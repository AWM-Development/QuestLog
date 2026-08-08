import { execFileSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { readRepoFile, resolveRepoRoot } from "./guard-utils.js";

const TICKET_FILE_RE =
	/^Docs\/tickets\/(queue|backlog|in-progress|done)\/(T-\d+)-.*\.md$/;
const GATE_ID_RE = /^Gated on:\s*(G-\d+)/m;
const BLOCKED_ON_LINE_RE = /^Blocked on:\s*(.+)$/m;
const TICKET_ID_RE = /T-\d+/g;
const GATE_FILE_ID_RE = /^(G-\d+)-/;
const TICKET_FILE_ID_RE = /^(T-\d+)-/;

export function parseGatedOn(content: string): string | null {
	const match = content.match(GATE_ID_RE);
	return match?.[1] ?? null;
}

export function parseBlockedOn(content: string): string[] {
	const match = content.match(BLOCKED_ON_LINE_RE);
	if (!match?.[1]) return [];
	return match[1].match(TICKET_ID_RE) ?? [];
}

export interface GateGuardIssue {
	ticketPath: string;
	message: string;
}

export interface GateGuardResult {
	ok: boolean;
	failures: GateGuardIssue[];
	warnings: GateGuardIssue[];
}

export interface GateGuardDeps {
	/** Paths changed by the PR's diff, repo-root-relative. Injected so tests never shell out to git. */
	listChangedFiles: () => string[];
	/** Current (post-diff) content of a file, or null if it no longer exists (deleted). */
	readFile: (path: string) => string | null;
	/** Basenames of files directly under `path`, or [] if the directory doesn't exist. */
	listDir: (path: string) => string[];
}

function idsFromDir(
	deps: GateGuardDeps,
	dir: string,
	idRe: RegExp,
): Set<string> {
	const ids = new Set<string>();
	for (const name of deps.listDir(dir)) {
		const id = name.match(idRe)?.[1];
		if (id) ids.add(id);
	}
	return ids;
}

/** The CLI's real entry function — everything `main()` does besides argv/exit wiring. Called directly by tests with synthetic-diff deps, and by `main()` with real git/fs deps. */
export function runGateGuard(deps: GateGuardDeps): GateGuardResult {
	const failures: GateGuardIssue[] = [];
	const warnings: GateGuardIssue[] = [];

	const unresolvedGateIds = idsFromDir(
		deps,
		"Docs/tickets/gated",
		GATE_FILE_ID_RE,
	);
	const resolvedGateIds = idsFromDir(
		deps,
		"Docs/tickets/gated/resolved",
		GATE_FILE_ID_RE,
	);
	const doneTicketIds = idsFromDir(
		deps,
		"Docs/tickets/done",
		TICKET_FILE_ID_RE,
	);

	for (const path of deps.listChangedFiles()) {
		const match = path.match(TICKET_FILE_RE);
		if (!match) continue;

		const content = deps.readFile(path);
		if (content === null) continue; // deleted in this diff — nothing to check

		// `backlog/` is the pipeline's designed holding pen for a ticket that
		// isn't ready yet (TICKET_SPEC.md Lifecycle) — an unresolved `Gated on:`
		// or an unmet `Blocked on:` there is the normal, intended resting state,
		// not a violation. Auto-promotion (Blocked on:) and /ungate (Gated on:)
		// are what clear it; only queue/in-progress/done are expected to have
		// already cleared both, so only those three still hard-fail on either.
		const inBacklog = match[1] === "backlog";

		const gatedOn = parseGatedOn(content);
		if (gatedOn !== null) {
			if (unresolvedGateIds.has(gatedOn)) {
				if (!inBacklog) {
					failures.push({
						ticketPath: path,
						message: `carries an unresolved Gated on: ${gatedOn} (still present under Docs/tickets/gated/) — only /ungate may clear this`,
					});
				}
			} else if (resolvedGateIds.has(gatedOn)) {
				warnings.push({
					ticketPath: path,
					message: `Gated on: ${gatedOn} was already resolved and moved to Docs/tickets/gated/resolved/ — stale reference, sync bug per GATE_SPEC.md`,
				});
			} else {
				warnings.push({
					ticketPath: path,
					message: `Gated on: ${gatedOn} references a gate that isn't under Docs/tickets/gated/ or gated/resolved/ — check for a typo or stale reference`,
				});
			}
		}

		const blockedOn = parseBlockedOn(content);
		const unmet = blockedOn.filter((id) => !doneTicketIds.has(id));
		if (unmet.length > 0 && !inBacklog) {
			failures.push({
				ticketPath: path,
				message: `carries Blocked on: ${unmet.join(", ")} — no matching file under Docs/tickets/done/ yet`,
			});
		}
	}

	return { ok: failures.length === 0, failures, warnings };
}

function gitDiffChangedFiles(repoRoot: string, baseRef: string): string[] {
	const output = execFileSync(
		"git",
		["diff", "--name-only", `${baseRef}...HEAD`],
		{
			encoding: "utf-8",
			cwd: repoRoot,
		},
	);
	return output.split("\n").filter((line) => line.length > 0);
}

function realDeps(baseRef: string): GateGuardDeps {
	const repoRoot = resolveRepoRoot();
	return {
		listChangedFiles: () => gitDiffChangedFiles(repoRoot, baseRef),
		readFile: (path) => readRepoFile(repoRoot, path),
		listDir: (dir) => {
			const abs = join(repoRoot, dir);
			return existsSync(abs) ? readdirSync(abs) : [];
		},
	};
}

function printResult(result: GateGuardResult): void {
	for (const warning of result.warnings) {
		console.warn(`⚠️  ${warning.ticketPath}: ${warning.message}`);
	}
	for (const failure of result.failures) {
		console.error(`❌ ${failure.ticketPath}: ${failure.message}`);
	}
	if (result.ok) {
		console.log(
			"✅ Gate guard passed — no unresolved Gated on:/unmet Blocked on: found.",
		);
	}
}

if (import.meta.url === `file://${process.argv[1]}`) {
	const baseRef = process.argv[2] ?? "origin/develop";
	const result = runGateGuard(realDeps(baseRef));
	printResult(result);
	process.exit(result.ok ? 0 : 1);
}
