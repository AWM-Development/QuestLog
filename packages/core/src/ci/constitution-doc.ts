const REQUIRED_AGENTS_SECTIONS = [
	"## Principles",
	"## Commands",
	"## Pointer map",
	"## Hard rules",
];

const TASK_SOURCE_RE = /Docs\/milestones\/MILESTONES_V1_MCP\.md/;
const CLAUDE_MD_MAX_LINES = 10;

export interface ConstitutionDocDeps {
	/** Content of a repo-root file, or null if it doesn't exist. */
	readFile: (path: string) => string | null;
}

export interface ConstitutionDocIssue {
	path: string;
	message: string;
}

export interface ConstitutionDocResult {
	ok: boolean;
	failures: ConstitutionDocIssue[];
}

/** Counts lines, ignoring a single trailing newline (which isn't a visible extra line in an editor). */
function lineCount(content: string): number {
	return content.replace(/\n$/, "").split("\n").length;
}

/**
 * T-105: AGENTS.md is the canonical constitution (full content); CLAUDE.md
 * is a thin pointer kept only for Claude Code's own auto-load convention.
 * See Docs/tickets/gated/resolved/G-020-pipeline-audit-and-improvement.md § Resolution.
 */
export function checkConstitutionDoc(
	deps: ConstitutionDocDeps,
): ConstitutionDocResult {
	const failures: ConstitutionDocIssue[] = [];

	const agents = deps.readFile("AGENTS.md");
	if (agents === null) {
		failures.push({ path: "AGENTS.md", message: "AGENTS.md does not exist" });
	} else {
		for (const heading of REQUIRED_AGENTS_SECTIONS) {
			if (!agents.includes(heading)) {
				failures.push({
					path: "AGENTS.md",
					message: `missing required section "${heading}"`,
				});
			}
		}
		if (!TASK_SOURCE_RE.test(agents)) {
			failures.push({
				path: "AGENTS.md",
				message: "missing task-source line naming the milestone docs",
			});
		}
	}

	const claude = deps.readFile("CLAUDE.md");
	if (claude === null) {
		failures.push({ path: "CLAUDE.md", message: "CLAUDE.md does not exist" });
	} else {
		const lines = lineCount(claude);
		if (lines > CLAUDE_MD_MAX_LINES) {
			failures.push({
				path: "CLAUDE.md",
				message: `has ${lines} lines, expected ≤${CLAUDE_MD_MAX_LINES}`,
			});
		}
		if (!claude.includes("AGENTS.md")) {
			failures.push({
				path: "CLAUDE.md",
				message: "does not mention AGENTS.md",
			});
		}
	}

	return { ok: failures.length === 0, failures };
}
