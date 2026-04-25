ALTER TABLE "sessions" ADD COLUMN "dismissed_entity_texts" jsonb DEFAULT '[]'::jsonb;
--> statement-breakpoint
CREATE INDEX "entities_name_trgm_idx" ON "entities" USING gin (name gin_trgm_ops);
