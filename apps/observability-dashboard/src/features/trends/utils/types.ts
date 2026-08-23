/**
 * Client-side shape of a `ticket_runs` row as returned by the
 * `observability.trends` tRPC query — mirrors
 * `packages/observability/src/schema/tables.ts`'s `ticketRuns` select shape,
 * trimmed to the fields the Trends view actually renders. Dates arrive as
 * ISO strings over the wire (superjson round-trips `Date` in practice, but
 * this type stays permissive since the wire shape isn't this app's to own).
 */
export interface TrendRun {
	ticketId: string | null;
	complexityTier: "s" | "m" | "l" | null;
	appliesRate: "intro" | "standard";
	theoreticalCostIntroUsd: number;
	theoreticalCostStandardUsd: number;
	totalSystemCostIntroUsd: number;
	totalSystemCostStandardUsd: number;
	inputTokens: number;
	outputTokens: number;
	cacheCreationInputTokens: number;
	cacheReadInputTokens: number;
	durationMs: number;
	turnCount: number;
	turnsToGreen: number | null;
	linesAdded: number | null;
	linesRemoved: number | null;
	emptyRun: boolean;
	createdAt: string | Date;
}
