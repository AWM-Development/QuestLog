import { type UsageArtifact, buildUsageArtifact } from "./artifact.js";
import type { TokenTotals } from "./usage-summary.js";

/**
 * Session-level result a `RunnerCostAdapter` reports back, before it's turned
 * into a `UsageArtifact`. A superset of what Claude Code's own transcript-
 * based capture produces (`tokenTotals` populated) and what a runner with no
 * transcript access can report (wall-clock duration plus its own
 * vendor-reported cost figure only). Mixing the two into one number would
 * silently corrupt cost data — see `G-020` § Notes 3 — so this type keeps
 * them as distinct, honestly-nullable fields instead.
 */
export interface RunCaptureResult {
	runner: string;
	ticketId: string | null;
	sessionId: string;
	durationMs: number;
	turnCount: number;
	/** null when the runner exposes no reliable "went green" signal — never fabricated. */
	turnsToGreen: number | null;
	/** null for Claude Code (fully autonomous) or any runner that doesn't expose one — never fabricated. */
	humanMessageCount: number | null;
	/** Full prompt-level token/cache breakdown — null for a degraded runner with no transcript access. */
	tokenTotals: TokenTotals | null;
	reviewerSubagentTokenTotals: TokenTotals | null;
	/** Vendor-reported cost in the runner's own unit (e.g. Devin ACUs) — set only when `tokenTotals` is null, since a USD theoretical cost can't be derived without a token breakdown. */
	vendorCost: { amount: number; unit: string } | null;
}

/** Runner-neutral seam `capture-usage.ts`'s Claude Code path now implements — see T-109 / `G-020` § Notes 3. */
export interface RunnerCostAdapter {
	resolveTicketId(): string | null;
	captureRun(projectDir: string): RunCaptureResult;
}

const ZERO_TOTALS: TokenTotals = {
	inputTokens: 0,
	outputTokens: 0,
	cacheCreationInputTokens: 0,
	cacheCreation5mTokens: 0,
	cacheCreation1hTokens: 0,
	cacheReadInputTokens: 0,
};

/**
 * Converts a `RunCaptureResult` into the `UsageArtifact` shape
 * `ingestUsageArtifact` expects. A full-breakdown result (Claude Code today)
 * gets the exact same theoretical-cost computation `buildUsageArtifact`
 * always did — pure passthrough, zero behavior change. A degraded result
 * (`tokenTotals: null`) zero-fills the Claude-Code-only token fields rather
 * than fabricating a number; its `vendorCost` isn't persisted here — surfacing
 * a runner's own-unit cost in the observability store is dashboard/UI work
 * this ticket explicitly leaves out of scope (`M-OBS.5`'s tickets own that).
 */
export function buildUsageArtifactFromRunCaptureResult(
	result: RunCaptureResult,
	asOf?: Date,
): UsageArtifact {
	return buildUsageArtifact({
		ticketId: result.ticketId,
		sessionId: result.sessionId,
		main: {
			...(result.tokenTotals ?? ZERO_TOTALS),
			durationMs: result.durationMs,
			turnCount: result.turnCount,
			turnsToGreen: result.turnsToGreen,
		},
		reviewerSubagent: result.reviewerSubagentTokenTotals,
		asOf,
		runner: result.runner,
	});
}
