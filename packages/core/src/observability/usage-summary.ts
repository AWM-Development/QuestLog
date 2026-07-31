export interface TokenTotals {
	inputTokens: number;
	outputTokens: number;
	/** Sum of the two buckets below — kept for display; pricing reads the split fields instead. */
	cacheCreationInputTokens: number;
	cacheCreation5mTokens: number;
	cacheCreation1hTokens: number;
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
	/** Per-TTL cache-write split the API reports alongside the flat total above. */
	cache_creation?: {
		ephemeral_5m_input_tokens?: number;
		ephemeral_1h_input_tokens?: number;
	};
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

// The harness injects non-human `user`-role turns as array content with a
// bare `type: "text"` block (no `tool_result`) — skill/slash-command load
// expansions and interrupt notices are the two confirmed shapes (found in
// this project's own transcripts; see Docs/IMPLEMENTATION_NOTES.md § T-095).
// Neither is a human typing a message, so both must be excluded from
// humanMessageCount or manually_inspected false-positives on nearly every run.
const INTERRUPT_NOTICE_PATTERN = /^\[Request interrupted by user.*\]$/;
const SKILL_LOAD_PREAMBLE = "Base directory for this skill:";

/** True if a `type: "text"` user-turn block is harness-injected rather than something Alex actually typed. */
function isInjectedTextBlock(text: string): boolean {
	const trimmed = text.trim();
	return (
		INTERRUPT_NOTICE_PATTERN.test(trimmed) ||
		trimmed.startsWith(SKILL_LOAD_PREAMBLE)
	);
}

/** True if a user-turn's content array is a single harness-injected text block, not a human-typed message. */
function isInjectedTextTurn(content: unknown[]): boolean {
	if (content.length !== 1) return false;
	const block = content[0];
	if (!block || typeof block !== "object") return false;
	const { type, text } = block as { type?: unknown; text?: unknown };
	return (
		type === "text" && typeof text === "string" && isInjectedTextBlock(text)
	);
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
		cacheCreation5mTokens: a.cacheCreation5mTokens + b.cacheCreation5mTokens,
		cacheCreation1hTokens: a.cacheCreation1hTokens + b.cacheCreation1hTokens,
		cacheReadInputTokens: a.cacheReadInputTokens + b.cacheReadInputTokens,
	};
}

/** Sums token usage, duration, turn count, turns-to-green, and human-message detection out of one transcript's raw JSONL content. */
export function summarizeUsage(jsonl: string): UsageSummary {
	const entries = parseLines(jsonl);

	let inputTokens = 0;
	let outputTokens = 0;
	let cacheCreationInputTokens = 0;
	let cacheCreation5mTokens = 0;
	let cacheCreation1hTokens = 0;
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

			// The API reports which TTL each cache-write actually used; only when
			// a turn predates that split being logged do we fall back to this
			// project's 1h-TTL default (see Docs/IMPLEMENTATION_NOTES.md § T-046).
			if (u.cache_creation) {
				cacheCreation5mTokens +=
					u.cache_creation.ephemeral_5m_input_tokens ?? 0;
				cacheCreation1hTokens +=
					u.cache_creation.ephemeral_1h_input_tokens ?? 0;
			} else {
				cacheCreation1hTokens += u.cache_creation_input_tokens ?? 0;
			}
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
				} else if (!isInjectedTextTurn(content)) {
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
		cacheCreation5mTokens,
		cacheCreation1hTokens,
		cacheReadInputTokens,
		durationMs,
		turnCount,
		turnsToGreen,
		humanMessageCount,
		manuallyInspected: humanMessageCount > 1,
	};
}

/** Resolves the ticket id a session actively worked, from the `tmp/.active-ticket` marker's contents — trimmed, or null if absent/empty. */
export function resolveTicketId(
	activeTicketMarker: string | null,
): string | null {
	const trimmed = activeTicketMarker?.trim();
	return trimmed ? trimmed : null;
}

/** Null means "don't write an artifact" — only sessions actively working a ticket (a non-null ticketId) get tracked; see Docs/IMPLEMENTATION_NOTES.md § T-046/G-011. */
export function resolveArtifactPath(ticketId: string | null): string | null {
	if (ticketId === null) {
		return null;
	}
	return `Docs/tickets/cost-reports/${ticketId}.usage.json`;
}
