/**
 * Embedding service: calls Voyage AI embeddings API and inserts chunks into the DB.
 *
 * Uses voyage-4-lite (1024 dimensions).
 * Batches requests in groups of 128 (Voyage API max).
 */

import type { Database } from "../db/index.js";
import { chunks } from "../db/schema/index.js";
import type { TextChunk } from "./chunking.service.js";

const VOYAGE_EMBEDDINGS_URL = "https://api.voyageai.com/v1/embeddings";
const EMBEDDING_MODEL = "voyage-4-lite";
const BATCH_SIZE = 128;

type FetchFn = typeof globalThis.fetch;

export interface EmbedOptions {
	/** Override fetch for testing. */
	fetchFn?: FetchFn;
}

interface EmbeddingResponse {
	data: Array<{ embedding: number[]; index: number }>;
}

/**
 * Embed text chunks via Voyage AI and insert them into the chunks table.
 * Skips silently if VOYAGE_API_KEY is not set (dev-mode guard).
 */
export async function embedChunks(
	db: Database,
	textChunks: TextChunk[],
	options?: EmbedOptions,
): Promise<void> {
	if (textChunks.length === 0) return;

	const apiKey = process.env.VOYAGE_API_KEY;
	const fetchFn = options?.fetchFn ?? globalThis.fetch;

	if (!apiKey && !options?.fetchFn) {
		console.warn(
			"[embedding] VOYAGE_API_KEY not set — skipping embedding. Chunks will not be stored.",
		);
		return;
	}

	for (let i = 0; i < textChunks.length; i += BATCH_SIZE) {
		const batch = textChunks.slice(i, i + BATCH_SIZE);
		const texts = batch.map((c) => c.content);

		const response = await fetchFn(VOYAGE_EMBEDDINGS_URL, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${apiKey ?? "test"}`,
			},
			body: JSON.stringify({
				model: EMBEDDING_MODEL,
				input: texts,
				input_type: "document",
			}),
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(
				`Voyage embeddings API error (${response.status}): ${errorText}`,
			);
		}

		const result = (await response.json()) as EmbeddingResponse;

		const insertValues = batch.map((chunk, batchIndex) => {
			const embeddingData = result.data.find((d) => d.index === batchIndex);
			return {
				campaignId: chunk.campaignId,
				sourceId: chunk.sourceId,
				content: chunk.content,
				embedding: embeddingData?.embedding ?? [],
				metadata: {
					position: chunk.position,
					tokenEstimate: Math.ceil(
						chunk.content.split(/\s+/).filter(Boolean).length / 0.75,
					),
				},
			};
		});

		await db.insert(chunks).values(insertValues);
	}
}
