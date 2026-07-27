import {
	existsSync,
	mkdirSync,
	readFileSync,
	readdirSync,
	writeFileSync,
} from "node:fs";
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
	/** Resolves the ticket id this run processed, or null (empty run). Injected so tests never shell out to git. */
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

/** Thin wrapper: reads the transcript(s), delegates all computation to observability's pure functions, writes the artifact file. */
export function captureUsage(
	payload: HookPayload,
	projectDir: string,
	deps: CaptureUsageDeps,
): { artifactPath: string; artifact: UsageArtifact } {
	const mainJsonl = readFileSync(payload.transcript_path, "utf-8");
	const mainSummary = summarizeUsage(mainJsonl);
	const reviewerSubagentTotals = readSiblingSubagentTotals(
		payload.transcript_path,
	);

	const ticketId = deps.resolveTicketId();

	const artifact = buildUsageArtifact({
		ticketId,
		sessionId: payload.session_id,
		main: mainSummary,
		reviewerSubagent: reviewerSubagentTotals,
	});

	const artifactPath = join(
		projectDir,
		resolveArtifactPath(ticketId, payload.session_id),
	);
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

// Entry point: reads the Stop hook's stdin JSON payload and writes the usage artifact.
if (import.meta.url === `file://${process.argv[1]}`) {
	const projectDir = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
	const stdin = readFileSync(0, "utf-8");
	const payload = JSON.parse(stdin) as HookPayload;
	captureUsage(payload, projectDir, {
		resolveTicketId: () => resolveActiveTicketId(projectDir),
	});
}
