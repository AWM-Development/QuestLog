CREATE INDEX "chunks_campaign_id_idx" ON "chunks" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "conversations_campaign_id_idx" ON "conversations" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "entities_campaign_id_idx" ON "entities" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "entity_relationships_campaign_id_idx" ON "entity_relationships" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "sessions_campaign_id_idx" ON "sessions" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "sources_campaign_id_idx" ON "sources" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "write_requests_campaign_id_idx" ON "write_requests" USING btree ("campaign_id");