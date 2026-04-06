-- Resize chunks.embedding from vector(1536) to vector(1024) to match the
-- Voyage AI voyage-3 embedding dimension. pgvector cannot change a vector
-- column's dimension in place, so the column is dropped and recreated.
-- This destroys any embedded chunk data; re-import sources to repopulate.
ALTER TABLE "chunks" DROP COLUMN "embedding";--> statement-breakpoint
ALTER TABLE "chunks" ADD COLUMN "embedding" vector(1024);
