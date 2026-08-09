ALTER TABLE "ticket_runs" ADD COLUMN "runner" text;--> statement-breakpoint
-- T-108: every row ingested to date came from a Claude Code run — backfill
-- so "how many Claude runs exist" stays a plain equality query instead of
-- `runner IS NULL OR runner = 'claude-code'` forever.
UPDATE "ticket_runs" SET "runner" = 'claude-code' WHERE "runner" IS NULL;