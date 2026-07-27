import { execSync } from "node:child_process";
import {
	existsSync,
	mkdirSync,
	readFileSync,
	readdirSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { type UsageArtifact, buildUsageArtifact } from "./artifact.js";
import {
	type TokenTotals,
	addTokenTotals,
	resolveArtifactPath,
	summarizeUsage,
} from "./usage-summary.js";
import { resolveTicketId } from "./usage-summary.js";

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

/** Real (impure) ticket-id resolution: recent commit subjects, falling back to the newest done/blocked ticket file's mtime. */
function resolveTicketIdFromRepo(projectDir: string): string | null {
	let subjects: string[] = [];
	try {
		const log = execSync("git log -5 --format=%s", {
			cwd: projectDir,
			encoding: "utf-8",
		});
		subjects = log.split("\n").filter(Boolean);
	} catch {
		subjects = [];
	}

	const doneAndBlockedFiles = [
		"Docs/tickets/done",
		"Docs/tickets/blocked",
	].flatMap((rel) => {
		const dir = join(projectDir, rel);
		if (!existsSync(dir)) return [];
		return readdirSync(dir)
			.filter((name) => name.endsWith(".md"))
			.map((name) => ({ name, mtimeMs: statSync(join(dir, name)).mtimeMs }));
	});

	return resolveTicketId({
		recentCommitSubjects: subjects,
		doneAndBlockedFiles,
	});
}

// Entry point: reads the Stop hook's stdin JSON payload and writes the usage artifact.
if (import.meta.url === `file://${process.argv[1]}`) {
	const projectDir = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
	const stdin = readFileSync(0, "utf-8");
	const payload = JSON.parse(stdin) as HookPayload;
	captureUsage(payload, projectDir, {
		resolveTicketId: () => resolveTicketIdFromRepo(projectDir),
	});
}
