import {
	boolean,
	index,
	integer,
	jsonb,
	numeric,
	pgTable,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";

/** Shape of the `reviewer_subagent` JSONB column — mirrors `UsageArtifact["reviewer_subagent"]` from `@questlog/core/observability/artifact.js`. */
export interface ReviewerSubagentCost {
	input_tokens: number;
	output_tokens: number;
	cache_creation_input_tokens: number;
	cache_read_input_tokens: number;
	theoretical_cost_usd: {
		applies_rate: "intro" | "standard";
		intro_usd: number;
		standard_usd: number;
	};
}

// Keyed by `ticket_id`, nullable rather than the primary key — an empty run
// (no resolvable ticket, T-046's `empty_run` case) still needs a row. There
// is no DB-level uniqueness constraint on `ticket_id`: `ingest.ts`'s upsert
// does a select-then-update/insert instead, since a partial unique index
// (unique only when non-null) isn't worth the extra complexity for a
// single-writer CLI. See G-003's resolution for why this schema lives in its
// own package/branch rather than `packages/core/src/db/schema/tables.ts`.
export const ticketRuns = pgTable(
	"ticket_runs",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		ticketId: text("ticket_id"),
		// Nullable placeholder column, ingest.ts defaults it — see
		// IMPLEMENTATION_NOTES.md § T-108 for why.
		runner: text("runner"),
		emptyRun: boolean("empty_run").notNull().default(false),
		sessionId: text("session_id").notNull(),
		inputTokens: integer("input_tokens").notNull(),
		outputTokens: integer("output_tokens").notNull(),
		cacheCreationInputTokens: integer("cache_creation_input_tokens").notNull(),
		cacheReadInputTokens: integer("cache_read_input_tokens").notNull(),
		durationMs: integer("duration_ms").notNull(),
		turnCount: integer("turn_count").notNull(),
		turnsToGreen: integer("turns_to_green"),
		appliesRate: text("applies_rate").notNull(),
		theoreticalCostIntroUsd: numeric("theoretical_cost_intro_usd", {
			precision: 12,
			scale: 6,
			mode: "number",
		}).notNull(),
		theoreticalCostStandardUsd: numeric("theoretical_cost_standard_usd", {
			precision: 12,
			scale: 6,
			mode: "number",
		}).notNull(),
		reviewerSubagent: jsonb("reviewer_subagent").$type<ReviewerSubagentCost>(),
		totalSystemCostIntroUsd: numeric("total_system_cost_intro_usd", {
			precision: 12,
			scale: 6,
			mode: "number",
		}).notNull(),
		totalSystemCostStandardUsd: numeric("total_system_cost_standard_usd", {
			precision: 12,
			scale: 6,
			mode: "number",
		}).notNull(),
		// Placeholder columns for fields landing from other, not-yet-shipped
		// tickets (G-003's expanded field list) — declared but not populated
		// here.
		complexityTier: text("complexity_tier"), // T-050
		strategyGateFlag: boolean("strategy_gate_flag"), // T-050
		costVsHumanEquivalent: numeric("cost_vs_human_equivalent", {
			precision: 12,
			scale: 6,
			mode: "number",
		}), // T-051
		filesChanged: integer("files_changed"), // future PR diff-stat sync
		linesAdded: integer("lines_added"), // future PR diff-stat sync
		linesRemoved: integer("lines_removed"), // future PR diff-stat sync
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		index("ticket_runs_ticket_id_idx").using("btree", table.ticketId),
	],
);

export const ticketReports = pgTable(
	"ticket_reports",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		ticketId: text("ticket_id").notNull(),
		reportType: text("report_type")
			.$type<"shipped" | "blocked" | "wont_fix">()
			.notNull(),
		reviewerVerdict: text("reviewer_verdict").$type<
			"PASS" | "PASS-WITH-NOTES" | "FAIL"
		>(),
		remediationPassRequired: boolean("remediation_pass_required")
			.notNull()
			.default(false),
		content: text("content").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.notNull()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		index("ticket_reports_ticket_id_idx").using("btree", table.ticketId),
	],
);
