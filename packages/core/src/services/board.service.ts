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
	branch: string | null;
	scopeExcerpt: string | null;
	status: TicketStatus;
	path: string;
}

const SCOPE_EXCERPT_MAX_LENGTH = 160;

/**
 * Every top-level field name a ticket file's boundary detection needs to
 * recognize: `TICKET_SPEC.md`'s field set, plus `Branch` and `Scope`
 * themselves, the two fields this map unifies into one mechanism. A field
 * boundary only fires on one of these literal names now, never on the old
 * "capitalized word ending in a colon" shape heuristic — which could
 * misfire on a hard-wrapped `Scope:` line that merely looked like a field
 * header (e.g. "Note: fall back to null.") and silently truncate early.
 */
const TOP_LEVEL_FIELDS = [
	"Milestone ref",
	"Complexity tier",
	"Strategy-gate flag",
	"Priority",
	"Blocked on",
	"Gated on",
	"Branch",
	"Context files",
	"Mockup",
	"Runner",
	"Model",
	"Scope",
	"Out of scope",
	"Iteration cap",
	"Definition of done includes",
] as const;

const FIELD_START_PATTERN = new RegExp(
	`^(${TOP_LEVEL_FIELDS.join("|")})(?:\\s*\\([^)]*\\))?:[ \\t]*`,
	"gm",
);

/**
 * Walks a ticket file's content once, returning every recognized field's
 * raw (unbounded-whitespace) value keyed by field name — a field's value is
 * whatever text sits between its own label and the next recognized field
 * label (or end of file). Single-line fields (`Priority`, `Branch`, ...)
 * and the multi-line `Scope:` field both read from this same map instead of
 * two separate parsing strategies; callers decide per-field whether to take
 * just the first line or the whole span.
 */
function parseAllFields(content: string): Map<string, string> {
	const matches = [...content.matchAll(FIELD_START_PATTERN)];
	const fields = new Map<string, string>();
	for (let i = 0; i < matches.length; i++) {
		const match = matches[i];
		const name = match?.[1];
		if (!match || !name || fields.has(name)) continue;
		const valueStart = match.index + match[0].length;
		const valueEnd = matches[i + 1]?.index ?? content.length;
		fields.set(name, content.slice(valueStart, valueEnd));
	}
	return fields;
}

/** A single-line field's value is just the first line of its raw span, trimmed. */
function singleLineValue(raw: string | undefined): string | null {
	const firstLine = raw?.split("\n", 1)[0]?.trim();
	return firstLine || null;
}

/**
 * `Scope:`'s value runs until the next top-level field, not to end-of-line
 * — unlike every other field — so its raw span is collapsed to one line and
 * truncated at a word boundary rather than just trimmed.
 */
function scopeExcerptValue(raw: string | undefined): string | null {
	const collapsed = raw?.trim().replace(/\s+/g, " ");
	if (!collapsed) return null;
	if (collapsed.length <= SCOPE_EXCERPT_MAX_LENGTH) return collapsed;

	const cut = collapsed.slice(0, SCOPE_EXCERPT_MAX_LENGTH);
	const lastSpace = cut.lastIndexOf(" ");
	const truncated = lastSpace > 0 ? cut.slice(0, lastSpace) : cut;
	return `${truncated}…`;
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
	const fields = parseAllFields(content);

	return {
		id,
		title: title.trim(),
		priority: singleLineValue(fields.get("Priority")),
		complexityTier: singleLineValue(fields.get("Complexity tier")),
		blockedOn: singleLineValue(fields.get("Blocked on")),
		gatedOn: singleLineValue(fields.get("Gated on")),
		branch: singleLineValue(fields.get("Branch")),
		scopeExcerpt: scopeExcerptValue(fields.get("Scope")),
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
