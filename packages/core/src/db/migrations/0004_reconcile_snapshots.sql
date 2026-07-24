-- No-op reconciliation migration. The schema-level state described here
-- (vector(1024) embedding, token columns on messages) was already applied
-- by migrations 0002 and 0003. This file exists so the meta/*_snapshot.json
-- files match the live schema, eliminating phantom diffs from drizzle-kit
-- generate. Statements use IF NOT EXISTS so they're safe on any DB state.
ALTER TABLE "chunks" ALTER COLUMN "embedding" SET DATA TYPE vector(1024);--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "input_tokens" integer;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "output_tokens" integer;
