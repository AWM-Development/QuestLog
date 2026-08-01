ALTER TABLE "chunks" ADD COLUMN "status" text DEFAULT 'active' NOT NULL;--> statement-breakpoint
CREATE INDEX "chunks_status_idx" ON "chunks" USING btree ("status");