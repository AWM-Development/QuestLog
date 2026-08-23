CREATE TABLE "chunk_corrections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"correction_text" text NOT NULL,
	"superseded_chunk_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_chunk_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chunk_corrections" ADD CONSTRAINT "chunk_corrections_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chunk_corrections_campaign_id_idx" ON "chunk_corrections" USING btree ("campaign_id");