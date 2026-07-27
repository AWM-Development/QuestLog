export interface TokenTotals {
	inputTokens: number;
	outputTokens: number;
	cacheCreationInputTokens: number;
	cacheReadInputTokens: number;
}

export interface UsageSummary extends TokenTotals {
	durationMs: number;
	turnCount: number;
	turnsToGreen: number | null;
	humanMessageCount: number;
	manuallyInspected: boolean;
}

interface TranscriptUsagePayload {
	input_tokens?: number;
	output_tokens?: number;
	cache_creation_input_tokens?: number;
	cache_read_input_tokens?: number;
}

interface TranscriptEntry {
	type?: string;
	timestamp?: string;
	message?: {
		role?: string;
		content?: unknown;
		usage?: TranscriptUsagePayload;
	};
}

function parseLines(jsonl: string): TranscriptEntry[] {
	return jsonl
		.split("\n")
		.map((line) => line.trim())
		.filter(Boolean)
		.map((line) => JSON.parse(line) as TranscriptEntry);
}

/** Pulls the text of a `tool_result` block out of a user-message content array, if present. */
function extractToolResultText(content: unknown[]): string | null {
	for (const block of content) {
		if (
			block &&
			typeof block === "object" &&
			(block as { type?: unknown }).type === "tool_result"
		) {
			const inner = (block as { content?: unknown }).content;
			if (typeof inner === "string") return inner;
			if (Array.isArray(inner)) {
				return inner
					.map((b) =>
						typeof (b as { text?: unknown })?.text === "string"
							? (b as { text: string }).text
							: "",
					)
					.join("\n");
			}
		}
	}
	return null;
}

// scripts/run-tests-quiet.sh (T-048) prints exactly these three lines on a
// fully-passing lint+typecheck+test run, and "FAIL" only on a failing stage —
// this is the signature a tool_result's captured stdout must match to count
// as Step 4 of EXECUTOR_ROUTINE.md going green.
function isPassingTestRunOutput(text: string): boolean {
	return (
		text.includes("lint: pass") &&
		text.includes("typecheck: pass") &&
		text.includes("test: pass") &&
		!text.includes("FAIL")
	);
}

export function addTokenTotals(a: TokenTotals, b: TokenTotals): TokenTotals {
	return {
		inputTokens: a.inputTokens + b.inputTokens,
		outputTokens: a.outputTokens + b.outputTokens,
		cacheCreationInputTokens:
			a.cacheCreationInputTokens + b.cacheCreationInputTokens,
		cacheReadInputTokens: a.cacheReadInputTokens + b.cacheReadInputTokens,
	};
}

/** Sums token usage, duration, turn count, turns-to-green, and human-message detection out of one transcript's raw JSONL content. */
export function summarizeUsage(jsonl: string): UsageSummary {
	const entries = parseLines(jsonl);

	let inputTokens = 0;
	let outputTokens = 0;
	let cacheCreationInputTokens = 0;
	let cacheReadInputTokens = 0;
	let turnCount = 0;
	let turnsToGreen: number | null = null;
	let humanMessageCount = 0;
	let firstTimestamp: number | null = null;
	let lastTimestamp: number | null = null;

	for (const entry of entries) {
		if (entry.timestamp) {
			const t = Date.parse(entry.timestamp);
			if (!Number.isNaN(t)) {
				if (firstTimestamp === null) firstTimestamp = t;
				lastTimestamp = t;
			}
		}

		if (entry.type === "assistant" && entry.message?.usage) {
			turnCount += 1;
			const u = entry.message.usage;
			inputTokens += u.input_tokens ?? 0;
			outputTokens += u.output_tokens ?? 0;
			cacheCreationInputTokens += u.cache_creation_input_tokens ?? 0;
			cacheReadInputTokens += u.cache_read_input_tokens ?? 0;
			continue;
		}

		if (entry.type === "user" && entry.message?.role === "user") {
			const content = entry.message.content;
			if (typeof content === "string") {
				humanMessageCount += 1;
			} else if (Array.isArray(content)) {
				const toolResultText = extractToolResultText(content);
				if (toolResultText !== null) {
					if (turnsToGreen === null && isPassingTestRunOutput(toolResultText)) {
						turnsToGreen = turnCount;
					}
				} else {
					humanMessageCount += 1;
				}
			}
		}
	}

	const durationMs =
		firstTimestamp !== null && lastTimestamp !== null
			? lastTimestamp - firstTimestamp
			: 0;

	return {
		inputTokens,
		outputTokens,
		cacheCreationInputTokens,
		cacheReadInputTokens,
		durationMs,
		turnCount,
		turnsToGreen,
		humanMessageCount,
		manuallyInspected: humanMessageCount > 1,
	};
}

/** Given commit subjects (most recent first) and done/blocked files, resolves the ticket id a run processed, or null if none can be found. */
export function resolveTicketId(deps: {
	recentCommitSubjects: string[];
	doneAndBlockedFiles: Array<{ name: string; mtimeMs: number }>;
}): string | null {
	const pattern = /T-\d{3,}/;
	for (const subject of deps.recentCommitSubjects) {
		const match = subject.match(pattern);
		if (match) return match[0];
	}
	const [newest] = [...deps.doneAndBlockedFiles].sort(
		(a, b) => b.mtimeMs - a.mtimeMs,
	);
	if (!newest) return null;
	const match = newest.name.match(pattern);
	return match ? match[0] : null;
}

export function resolveArtifactPath(
	ticketId: string | null,
	sessionId: string,
): string {
	if (ticketId === null) {
		return `Docs/tickets/reports/empty-run-${sessionId}.usage.json`;
	}
	return `Docs/tickets/reports/${ticketId}.usage.json`;
}
