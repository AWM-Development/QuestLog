import {
	existsSync,
	mkdirSync,
	readFileSync,
	readdirSync,
	writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { type UsageArtifact, buildUsageArtifact } from "./artifact.js";
import {
	type TokenTotals,
	addTokenTotals,
	resolveArtifactPath,
	resolveTicketId,
	summarizeUsage,
} from "./usage-summary.js";

export interface HookPayload {
	transcript_path: string;
	session_id: string;
}

export interface CaptureUsageDeps {
	/** Resolves the ticket id this run processed, or null (no active ticket — nothing gets written). Injected so tests never shell out to git. */
	resolveTicketId: () => string | null;
}

const ZERO_TOTALS: TokenTotals = {
	inputTokens: 0,
	outputTokens: 0,
	cacheCreationInputTokens: 0,
	cacheCreation5mTokens: 0,
	cacheCreation1hTokens: 0,
	cacheReadInputTokens: 0,
};

function readSiblingSubagentTotals(transcriptPath: string): TokenTotals | null {
	const subagentsDir = join(dirname(transcriptPath), "subagents");
	if (!existsSync(subagentsDir)) return null;

	const files = readdirSync(subagentsDir).filter((f) => f.endsWith(".jsonl"));
	if (files.length === 0) return null;

	return files.reduce((acc, file) => {
		const content = readFileSync(join(subagentsDir, file), "utf-8");
		return addTokenTotals(acc, summarizeUsage(content));
	}, ZERO_TOTALS);
}

/** Thin wrapper: reads the transcript(s), delegates all computation to observability's pure functions, writes the artifact file. No active ticket means no artifact — skips reading the transcript entirely rather than writing a session it's not tracking. */
export function captureUsage(
	payload: HookPayload,
	projectDir: string,
	deps: CaptureUsageDeps,
): { artifactPath: string | null; artifact: UsageArtifact | null } {
	const ticketId = deps.resolveTicketId();
	const relativePath = resolveArtifactPath(ticketId);
	if (relativePath === null) {
		return { artifactPath: null, artifact: null };
	}

	const mainJsonl = readFileSync(payload.transcript_path, "utf-8");
	const mainSummary = summarizeUsage(mainJsonl);
	const reviewerSubagentTotals = readSiblingSubagentTotals(
		payload.transcript_path,
	);

	const artifact = buildUsageArtifact({
		ticketId,
		sessionId: payload.session_id,
		main: mainSummary,
		reviewerSubagent: reviewerSubagentTotals,
	});

	const artifactPath = join(projectDir, relativePath);
	mkdirSync(dirname(artifactPath), { recursive: true });
	writeFileSync(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`);

	return { artifactPath, artifact };
}

/** Real (impure) ticket-id resolution: reads the explicit `tmp/.active-ticket` marker a session writes when it picks up ticket work (EXECUTOR_ROUTINE.md Step 2). No marker means no active ticket work — never a guess. Lives under `tmp/`, not `.claude/` — see T-062. */
export function resolveActiveTicketId(projectDir: string): string | null {
	const markerPath = join(projectDir, "tmp", ".active-ticket");
	if (!existsSync(markerPath)) return null;
	return resolveTicketId(readFileSync(markerPath, "utf-8"));
}

/** Derives {transcript_path, session_id} from CLAUDE_CODE_SESSION_ID + the CLI's transcript layout under ~/.claude/projects. Used whenever stdin carries no JSON payload — the only invocation path since T-069 removed the session-start.sh stash file. See Docs/IMPLEMENTATION_NOTES.md § T-069. */
export function resolveHookPayloadFromEnv(
	claudeHomeDir: string,
	sessionId: string | undefined,
): HookPayload | null {
	if (!sessionId) return null;

	const projectsDir = join(claudeHomeDir, ".claude", "projects");
	if (!existsSync(projectsDir)) return null;

	for (const projectName of readdirSync(projectsDir)) {
		const candidate = join(projectsDir, projectName, `${sessionId}.jsonl`);
		if (existsSync(candidate)) {
			return { transcript_path: candidate, session_id: sessionId };
		}
	}
	return null;
}

// Entry point: reads the Stop hook's stdin JSON payload and writes the usage artifact, falling back to resolveHookPayloadFromEnv (see its doc comment) when stdin is empty.
if (import.meta.url === `file://${process.argv[1]}`) {
	const projectDir = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
	let stdin = "";
	try {
		stdin = readFileSync(0, "utf-8");
	} catch {
		stdin = "";
	}

	const payload: HookPayload | null = stdin.trim()
		? (JSON.parse(stdin) as HookPayload)
		: resolveHookPayloadFromEnv(homedir(), process.env.CLAUDE_CODE_SESSION_ID);

	if (payload === null) {
		console.error(
			"capture-usage: no stdin payload and no session found via CLAUDE_CODE_SESSION_ID — skipping usage capture",
		);
		process.exit(0);
	}

	captureUsage(payload, projectDir, {
		resolveTicketId: () => resolveActiveTicketId(projectDir),
	});
}
