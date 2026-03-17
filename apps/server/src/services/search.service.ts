/**
 * Search service: embeds a query via Voyage AI and finds top-k similar chunks
 * filtered by campaignId using pgvector cosine distance (<=>).
 */

import { eq, sql } from "drizzle-orm";
import type { Database } from "../db/index.js";
import { chunks, sources } from "../db/schema/index.js";

const VOYAGE_EMBEDDINGS_URL = "https://api.voyageai.com/v1/embeddings";
const EMBEDDING_MODEL = "voyage-3";
const DEFAULT_LIMIT = 5;

type FetchFn = typeof globalThis.fetch;

export interface SearchInput {
	campaignId: string;
	query: string;
	limit?: number;
	/** Override fetch for testing. */
	fetchFn?: FetchFn;
}

export interface SearchResult {
	chunkId: string;
	content: string;
	score: number;
	sourceName: string | null;
	sourceId: string | null;
	metadata: Record<string, unknown>;
}

interface EmbeddingResponse {
	data: Array<{ embedding: number[]; index: number }>;
}

/** Embed a single query string via Voyage AI. */
async function embedQuery(query: string, fetchFn: FetchFn): Promise<number[]> {
	const apiKey = process.env.VOYAGE_API_KEY;

	const response = await fetchFn(VOYAGE_EMBEDDINGS_URL, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${apiKey ?? "test"}`,
		},
		body: JSON.stringify({
			model: EMBEDDING_MODEL,
			input: [query],
			input_type: "query",
		}),
	});

	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(
			`Voyage embeddings API error (${response.status}): ${errorText}`,
		);
	}

	const result = (await response.json()) as EmbeddingResponse;
	const embedding = result.data[0]?.embedding;
	if (!embedding) {
		throw new Error("Voyage API returned no embedding data");
	}
	return embedding;
}

export const searchService = {
	/**
	 * Embed a query and find top-k similar chunks for a campaign.
	 * Returns results ordered by cosine similarity (highest first).
	 */
	async search(db: Database, input: SearchInput): Promise<SearchResult[]> {
		const { campaignId, query, limit = DEFAULT_LIMIT } = input;
		const fetchFn = input.fetchFn ?? globalThis.fetch;

		const queryEmbedding = await embedQuery(query, fetchFn);
		const vectorLiteral = `[${queryEmbedding.join(",")}]`;

		// Use pgvector cosine distance operator (<=>).
		// Cosine distance = 1 - cosine_similarity, so score = 1 - distance.
		const rows = await db
			.select({
				chunkId: chunks.id,
				content: chunks.content,
				distance: sql<number>`${chunks.embedding} <=> ${vectorLiteral}::vector`,
				sourceName: sources.name,
				sourceId: chunks.sourceId,
				metadata: chunks.metadata,
			})
			.from(chunks)
			.leftJoin(sources, eq(chunks.sourceId, sources.id))
			.where(eq(chunks.campaignId, campaignId))
			.orderBy(sql`${chunks.embedding} <=> ${vectorLiteral}::vector`)
			.limit(limit);

		return rows.map((row) => ({
			chunkId: row.chunkId,
			content: row.content,
			score: 1 - Number(row.distance),
			sourceName: row.sourceName,
			sourceId: row.sourceId,
			metadata: (row.metadata ?? {}) as Record<string, unknown>,
		}));
	},
};
