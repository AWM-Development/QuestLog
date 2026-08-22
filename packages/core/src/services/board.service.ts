import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const REPO = "AWM-Development/QuestLog";
const TICKET_CACHE_TTL_MS = 60 * 1000;

export type TicketStatus =
	| "gated"
	| "backlog"
	| "queue"
	| "in-progress"
	| "done"
	| "blocked";

const STATUS_BY_FOLDER: Record<string, TicketStatus> = {
	gated: "gated",
	backlog: "backlog",
	queue: "queue",
	"in-progress": "in-progress",
	done: "done",
	blocked: "blocked",
};

export interface TicketCard {
	id: string;
	title: string;
	priority: string | null;
	complexityTier: string | null;
	blockedOn: string | null;
	gatedOn: string | null;
	status: TicketStatus;
	path: string;
}

/**
 * Derives a card's pipeline status from its path's top-level `Docs/tickets/`
 * folder. `gated/resolved/...` deliberately does not map to "gated" — a
 * resolved gate's ticket copy (if any) is inert, not a real board status
 * (ticket's Scope: "gated maps to a Gated status only for files directly
 * under Docs/tickets/gated/, not gated/resolved/").
 */
function deriveStatus(path: string): TicketStatus | null {
	const match = path.match(/^Docs\/tickets\/([^/]+)\/(.+\.md)$/);
	if (!match) return null;
	const [, folder, rest] = match;
	if (!folder || !rest) return null;
	if (folder === "gated" && rest.startsWith("resolved/")) return null;
	return STATUS_BY_FOLDER[folder] ?? null;
}

function matchField(content: string, field: string): string | null {
	const match = content.match(new RegExp(`^${field}:\\s*(.+)$`, "m"));
	return match?.[1] ? match[1].trim() : null;
}

/**
 * Parses one ticket (or gate-stub) file's raw content + its repo-relative
 * path into a board card, or `null` when the file isn't a card: a gate-stub
 * (`# G-### — ...` header, no `T-###` ticket header — ticket-writer/`/ungate`
 * file these directly under `Docs/tickets/gated/`, see `GATE_SPEC.md`) or a
 * file outside the six pipeline folders this board tracks.
 */
export function parseTicketFile(
	content: string,
	path: string,
): TicketCard | null {
	const status = deriveStatus(path);
	if (!status) return null;

	const titleMatch = content.match(/^#\s+(T-\d+)\s+—\s+(.+)$/m);
	if (!titleMatch?.[1] || !titleMatch[2]) return null;
	const [, id, title] = titleMatch;

	return {
		id,
		title: title.trim(),
		priority: matchField(content, "Priority"),
		complexityTier: matchField(content, "Complexity tier"),
		blockedOn: matchField(content, "Blocked on"),
		gatedOn: matchField(content, "Gated on"),
		status,
		path,
	};
}

/** Runs the `gh` CLI and parses its stdout as JSON — injected everywhere below so tests never shell out for real. Same shape as `packages/observability/src/diff-stat-sync.ts`'s `GhRunner` (not imported cross-package — `packages/core` doesn't depend on `packages/observability`, and this is a ~5-line duplication, not worth a new shared module for). */
export type GhRunner = (args: string[]) => Promise<unknown>;

export const runGh: GhRunner = async (args) => {
	const { stdout } = await execFileAsync("gh", args);
	return JSON.parse(stdout);
};

interface GitTreeEntry {
	path: string;
	type: string;
}

interface GitTreeResponse {
	tree: GitTreeEntry[];
}

interface GitContentResponse {
	content: string; // base64
}

/**
 * Fetches every `Docs/tickets/**\/*.md` file's raw content from GitHub's API
 * against `develop`, via `gh api` (this repo's established gh-CLI-over-a-
 * hand-rolled-client convention, `diff-stat-sync.ts`) rather than the raw
 * REST endpoints the ticket names as a fallback — `gh` is already assumed
 * available in this environment (`EXECUTOR_ROUTINE.md`).
 */
async function fetchTicketFiles(
	gh: GhRunner,
): Promise<{ path: string; content: string }[]> {
	const treeResponse = (await gh([
		"api",
		`repos/${REPO}/git/trees/develop?recursive=1`,
	])) as GitTreeResponse;

	const ticketPaths = treeResponse.tree
		.filter((entry) => entry.type === "blob")
		.map((entry) => entry.path)
		.filter((path) => path.startsWith("Docs/tickets/") && path.endsWith(".md"));

	return Promise.all(
		ticketPaths.map(async (path) => {
			const contentResponse = (await gh([
				"api",
				`repos/${REPO}/contents/${path}?ref=develop`,
			])) as GitContentResponse;
			return {
				path,
				content: Buffer.from(contentResponse.content, "base64").toString(
					"utf-8",
				),
			};
		}),
	);
}

export interface BoardService {
	list(now?: () => number): Promise<TicketCard[]>;
}

/**
 * Builds a `board.list` data source with its own private ~60s TTL cache
 * (ticket's Scope) so repeated calls within the window don't re-hit the
 * GitHub API. A factory rather than module-level state — `boardService`
 * below is the one long-lived instance the router uses; tests build their
 * own instance per-test instead of sharing (and polluting) cache state.
 * `now` is injectable per call so tests can control TTL expiry without real
 * timers.
 */
export function createBoardService(gh: GhRunner = runGh): BoardService {
	let cache: { cards: TicketCard[]; fetchedAt: number } | null = null;

	return {
		async list(now: () => number = Date.now): Promise<TicketCard[]> {
			const currentTime = now();
			if (cache && currentTime - cache.fetchedAt < TICKET_CACHE_TTL_MS) {
				return cache.cards;
			}

			const files = await fetchTicketFiles(gh);
			const cards = files
				.map(({ path, content }) => parseTicketFile(content, path))
				.filter((card): card is TicketCard => card !== null);

			cache = { cards, fetchedAt: currentTime };
			return cards;
		},
	};
}

/** The singleton instance `board.ts` (the tRPC router) calls through. */
export const boardService = createBoardService();
