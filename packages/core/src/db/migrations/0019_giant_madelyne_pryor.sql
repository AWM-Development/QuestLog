ALTER TABLE "entities" ADD COLUMN "linked_entity_id" uuid;--> statement-breakpoint
ALTER TABLE "entities" ADD CONSTRAINT "entities_linked_entity_id_entities_id_fk" FOREIGN KEY ("linked_entity_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "entities_linked_entity_id_idx" ON "entities" USING btree ("linked_entity_id");