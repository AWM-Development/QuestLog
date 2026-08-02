/**
 * Search service: embeds a query via Voyage AI and finds top-k similar chunks
 * filtered by campaignId using pgvector cosine distance (<=>).
 */

import { and, eq, ne, sql } from "drizzle-orm";
import type { Database } from "../db/index.js";
import { chunks, sources } from "../db/schema/index.js";
import { type FetchFn, callVoyageEmbeddings } from "./voyage.client.js";

const DEFAULT_LIMIT = 5;

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
	createdAt: Date;
}

/** Embed a single query string via Voyage AI. */
async function embedQuery(query: string, fetchFn?: FetchFn): Promise<number[]> {
	const result = await callVoyageEmbeddings({
		input: [query],
		inputType: "query",
		fetchFn,
	});

	if (!result) {
		throw new Error("Voyage API key not set and no fetchFn override provided");
	}

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
				createdAt: chunks.createdAt,
			})
			.from(chunks)
			.leftJoin(sources, eq(chunks.sourceId, sources.id))
			.where(
				and(eq(chunks.campaignId, campaignId), ne(chunks.status, "superseded")),
			)
			.orderBy(sql`${chunks.embedding} <=> ${vectorLiteral}::vector`)
			.limit(limit);

		return rows.map((row) => ({
			chunkId: row.chunkId,
			content: row.content,
			score: 1 - Number(row.distance),
			sourceName: row.sourceName,
			sourceId: row.sourceId,
			metadata: (row.metadata ?? {}) as Record<string, unknown>,
			createdAt: row.createdAt,
		}));
	},
};
