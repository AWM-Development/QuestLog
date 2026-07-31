CREATE TABLE "ticket_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" text NOT NULL,
	"report_type" text NOT NULL,
	"reviewer_verdict" text,
	"remediation_pass_required" boolean DEFAULT false NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ticket_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" text,
	"empty_run" boolean DEFAULT false NOT NULL,
	"session_id" text NOT NULL,
	"input_tokens" integer NOT NULL,
	"output_tokens" integer NOT NULL,
	"cache_creation_input_tokens" integer NOT NULL,
	"cache_read_input_tokens" integer NOT NULL,
	"duration_ms" integer NOT NULL,
	"turn_count" integer NOT NULL,
	"turns_to_green" integer,
	"human_message_count" integer NOT NULL,
	"manually_inspected" boolean NOT NULL,
	"applies_rate" text NOT NULL,
	"theoretical_cost_intro_usd" numeric(12, 6) NOT NULL,
	"theoretical_cost_standard_usd" numeric(12, 6) NOT NULL,
	"reviewer_subagent" jsonb,
	"total_system_cost_intro_usd" numeric(12, 6) NOT NULL,
	"total_system_cost_standard_usd" numeric(12, 6) NOT NULL,
	"complexity_tier" text,
	"strategy_gate_flag" boolean,
	"cost_vs_human_equivalent" numeric(12, 6),
	"files_changed" integer,
	"lines_added" integer,
	"lines_removed" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "ticket_reports_ticket_id_idx" ON "ticket_reports" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX "ticket_runs_ticket_id_idx" ON "ticket_runs" USING btree ("ticket_id");