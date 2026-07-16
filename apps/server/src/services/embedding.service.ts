/**
 * Embedding service: calls Voyage AI embeddings API and inserts chunks into the DB.
 *
 * Uses voyage-4-lite (1024 dimensions).
 * Batches requests in groups of 128 (Voyage API max).
 */

import type { Database, Transaction } from "../db/index.js";
import { chunks } from "../db/schema/index.js";
import { estimateTokens } from "../lib/utils.js";
import type { TextChunk } from "./chunking.service.js";
import {
	BATCH_SIZE,
	type FetchFn,
	callVoyageEmbeddings,
} from "./voyage.client.js";

export interface EmbedOptions {
	/** Override fetch for testing. */
	fetchFn?: FetchFn;
}

/**
 * Embed text chunks via Voyage AI and insert them into the chunks table.
 * Skips silently if VOYAGE_API_KEY is not set (dev-mode guard).
 */
export async function embedChunks(
	db: Database | Transaction,
	textChunks: TextChunk[],
	options?: EmbedOptions,
): Promise<void> {
	if (textChunks.length === 0) return;

	for (let i = 0; i < textChunks.length; i += BATCH_SIZE) {
		const batch = textChunks.slice(i, i + BATCH_SIZE);
		const texts = batch.map((c) => c.content);

		const result = await callVoyageEmbeddings({
			input: texts,
			inputType: "document",
			fetchFn: options?.fetchFn,
		});

		if (!result) {
			console.warn(
				"[embedding] VOYAGE_API_KEY not set — skipping embedding. Chunks will not be stored.",
			);
			return;
		}

		const insertValues = batch.map((chunk, batchIndex) => {
			const embeddingData = result.data.find((d) => d.index === batchIndex);
			return {
				campaignId: chunk.campaignId,
				sourceId: chunk.sourceId ?? null,
				sessionId: chunk.sessionId ?? null,
				content: chunk.content,
				embedding: embeddingData?.embedding ?? [],
				metadata: {
					position: chunk.position,
					tokenEstimate: estimateTokens(chunk.content),
				},
			};
		});

		await db.insert(chunks).values(insertValues);
	}
}
