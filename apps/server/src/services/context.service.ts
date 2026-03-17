/**
 * Context assembly service: builds an LLM context window for a campaign query.
 *
 * Sources assembled (in order of text appearance):
 *   1. Campaign metadata — name, description, game system, theme
 *   2. Relevant chunks  — hybrid (vector + keyword) search results, re-ranked with recency
 *   3. Campaign entities — all entities up to entity budget
 *   4. Conversation history — recent messages, oldest dropped first when budget is tight
 *
 * Token budget allocation (fractions of `tokenBudget`, default 100 000):
 *   Chunks      60 %
 *   History     25 %
 *   Entities    10 %
 *   Metadata     5 %
 *
 * Recency weighting: combined_score = (1-w)*similarity + w*recency, w = 0.1
 * Confidence score: average cosine similarity of the selected chunks (0
 * when no chunks present); will be surfaced in the UI at milestone 11.2.
 *
 * Hybrid search: vector search (Voyage AI) and keyword search (pg_trgm) run
 * in parallel. Results are merged before recency re-ranking:
 *   - Chunks in both result sets get a score boost (CONTEXT_CONFIG.dualMatchBoost), ensuring
 *     proper nouns and entity names that match both semantically and literally
 *     rank near the top.
 *   - Chunks only in keyword results enter the pool with their trgm similarity
 *     score, so older lore with exact name matches surfaces even when its
 *     embedding drifts from the query.
 */

import { desc, eq, sql } from "drizzle-orm";
import type { Database } from "../db/index.js";
import {
	campaigns,
	chunks,
	entities,
	messages,
	sources,
} from "../db/schema/index.js";
import { NotFoundError } from "../lib/errors.js";
import { estimateTokens } from "../lib/utils.js";
import type { SearchResult } from "./search.service.js";
import { searchService } from "./search.service.js";
import type { FetchFn } from "./voyage.client.js";

// ---------------------------------------------------------------------------
// Configuration — all tunable constants in one typed object
// ---------------------------------------------------------------------------

/**
 * Centralises every magic number used by context assembly.
 * Exported so tests can assert against the same values and so future
 * admin-panel / per-campaign overrides have a single place to wire into.
 */
export const CONTEXT_CONFIG = {
	/** Default total token budget for the assembled context window. */
	defaultTokenBudget: 100_000,
	/** Candidate chunks retrieved before budget trimming (vector + keyword each). */
	defaultSearchLimit: 40,

	/** Token budget allocation ratios (must sum to 1.0). */
	budgetRatios: {
		chunks: 0.6,
		history: 0.25,
		entities: 0.1,
		metadata: 0.05,
	},

	/** Fraction of combined score contributed by recency (0–1). */
	recencyWeight: 0.1,

	/** Minimum pg_trgm similarity score to include a chunk from keyword search. */
	keywordSearchThreshold: 0.1,
	/** Score boost when a chunk appears in both vector and keyword results. */
	dualMatchBoost: 0.1,
} as const;

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface ContextInput {
	query: string;
	campaignId: string;
	/** When provided, recent messages from this conversation are appended. */
	conversationId?: string;
	/** Maximum tokens for the assembled context. Default: 100 000. */
	tokenBudget?: number;
	/** Number of candidate chunks to retrieve before budget trimming. Default: 40. */
	searchLimit?: number;
	/** Override fetch for testing (passed through to search service). */
	fetchFn?: FetchFn;
}

export interface ContextCitation {
	chunkId: string;
	sourceName: string | null;
	sourceId: string | null;
}

export interface AssembledContext {
	/** Full assembled context text ready to be injected into an LLM prompt. */
	text: string;
	/** Source references for each chunk included in the context. */
	citations: ContextCitation[];
	/**
	 * Average cosine similarity of the selected chunks (0–1).
	 * 0 when no chunks are present. Used by milestone 11.2 for answer confidence UI.
	 */
	confidence: number;
	/** Estimated token count of the assembled text. */
	tokenCount: number;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Re-rank search results by blending cosine similarity with recency.
 *
 * recencyScore is normalised to [0, 1] within the result set so that the
 * very newest chunk scores 1.0 and the oldest scores 0.0.  When all chunks
 * share the same timestamp recencyScore is 0 for all (no change in ranking).
 */
function applyRecencyWeighting(
	results: SearchResult[],
): Array<SearchResult & { combinedScore: number }> {
	if (results.length === 0) return [];

	const times = results.map((r) => r.createdAt.getTime());
	const minTime = Math.min(...times);
	const maxTime = Math.max(...times);
	const timeRange = maxTime - minTime;

	const scored = results.map((r) => {
		const recencyScore =
			timeRange > 0 ? (r.createdAt.getTime() - minTime) / timeRange : 0;
		const combinedScore =
			(1 - CONTEXT_CONFIG.recencyWeight) * r.score +
			CONTEXT_CONFIG.recencyWeight * recencyScore;
		return { ...r, combinedScore };
	});

	scored.sort((a, b) => b.combinedScore - a.combinedScore);
	return scored;
}

/**
 * Run a pg_trgm similarity search against chunk content for a campaign.
 * Returns results ordered by trgm similarity (highest first).
 */
async function keywordSearch(
	db: Database,
	campaignId: string,
	query: string,
	limit: number,
): Promise<SearchResult[]> {
	// Compute similarity once in a subquery so the expression isn't
	// evaluated separately in SELECT, WHERE, and ORDER BY.
	const sq = db
		.select({
			chunkId: chunks.id,
			content: chunks.content,
			trgmScore: sql<number>`similarity(${chunks.content}, ${query})`.as(
				"trgm_score",
			),
			sourceName: sources.name,
			sourceId: chunks.sourceId,
			metadata: chunks.metadata,
			createdAt: chunks.createdAt,
		})
		.from(chunks)
		.leftJoin(sources, eq(chunks.sourceId, sources.id))
		.where(eq(chunks.campaignId, campaignId))
		.as("sq");

	const rows = await db
		.select()
		.from(sq)
		.where(sql`${sq.trgmScore} > ${CONTEXT_CONFIG.keywordSearchThreshold}`)
		.orderBy(sql`${sq.trgmScore} DESC`)
		.limit(limit);

	return rows.map((row) => ({
		chunkId: row.chunkId,
		content: row.content,
		score: Number(row.trgmScore),
		sourceName: row.sourceName,
		sourceId: row.sourceId,
		metadata: (row.metadata ?? {}) as Record<string, unknown>,
		createdAt: row.createdAt,
	}));
}

/**
 * Merge vector and keyword search results, deduplicating by chunk ID.
 *
 * Scoring rules:
 *   - Chunk in both result sets: vector score + CONTEXT_CONFIG.dualMatchBoost (capped at 1.0)
 *   - Chunk only in vector results: vector score unchanged
 *   - Chunk only in keyword results: trgm similarity score as-is
 *
 * Exported for unit testing.
 */
export function mergeSearchResults(
	vectorResults: SearchResult[],
	keywordResults: SearchResult[],
): SearchResult[] {
	const merged = new Map<string, SearchResult>();
	for (const r of vectorResults) {
		merged.set(r.chunkId, r);
	}

	// Single pass over keyword results: boost dual-matches, add keyword-only.
	for (const kw of keywordResults) {
		const existing = merged.get(kw.chunkId);
		if (existing) {
			// Dual match — boost the vector score (cap at 1.0)
			merged.set(kw.chunkId, {
				...existing,
				score: Math.min(1, existing.score + CONTEXT_CONFIG.dualMatchBoost),
			});
		} else {
			// Keyword-only — enter with trgm similarity score
			merged.set(kw.chunkId, kw);
		}
	}

	return Array.from(merged.values());
}

function formatCampaignMetadata(campaign: {
	name: string;
	description: string | null;
	gameSystem: string | null;
	theme: string;
}): string {
	const lines = ["## Campaign Information", `Name: ${campaign.name}`];
	if (campaign.description) lines.push(`Description: ${campaign.description}`);
	if (campaign.gameSystem) lines.push(`Game System: ${campaign.gameSystem}`);
	lines.push(`Theme: ${campaign.theme}`);
	return lines.join("\n");
}

function formatEntity(entity: {
	name: string;
	type: string;
	summary: string | null;
}): string {
	const desc = entity.summary ? `: ${entity.summary}` : "";
	return `${entity.name} (${entity.type})${desc}`;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export const contextService = {
	/**
	 * Assemble a context window for the given query and campaign.
	 *
	 * Always returns a valid AssembledContext — callers do not need to handle
	 * the empty-results case specially.
	 */
	async assemble(db: Database, input: ContextInput): Promise<AssembledContext> {
		const {
			query,
			campaignId,
			conversationId,
			tokenBudget = CONTEXT_CONFIG.defaultTokenBudget,
			searchLimit = CONTEXT_CONFIG.defaultSearchLimit,
		} = input;
		const fetchFn = input.fetchFn ?? globalThis.fetch;

		// -- Budget allocation ------------------------------------------------
		const { budgetRatios } = CONTEXT_CONFIG;
		const chunkBudget = Math.floor(tokenBudget * budgetRatios.chunks);
		const historyBudget = Math.floor(tokenBudget * budgetRatios.history);
		const entityBudget = Math.floor(tokenBudget * budgetRatios.entities);
		const metadataBudget = Math.floor(tokenBudget * budgetRatios.metadata);

		// -- Campaign metadata ------------------------------------------------
		const [campaign] = await db
			.select()
			.from(campaigns)
			.where(eq(campaigns.id, campaignId));

		if (!campaign) throw new NotFoundError("Campaign", campaignId);

		// -- Hybrid search: vector + keyword in parallel -----------------------
		const [vectorResults, kwResults] = await Promise.all([
			searchService.search(db, {
				campaignId,
				query,
				limit: searchLimit,
				fetchFn,
			}),
			keywordSearch(db, campaignId, query, searchLimit),
		]);

		const rawResults = mergeSearchResults(vectorResults, kwResults);

		// -- Recency re-ranking ------------------------------------------------
		const rankedResults = applyRecencyWeighting(rawResults);

		// Select chunks that fit within the chunk token budget.
		// We use "continue" rather than "break" so that a smaller chunk that
		// arrives later in the ranked list can still be included.
		const selectedChunks: typeof rankedResults = [];
		let chunkTokensUsed = 0;

		for (const result of rankedResults) {
			const tokens = estimateTokens(result.content);
			if (chunkTokensUsed + tokens > chunkBudget) continue;
			selectedChunks.push(result);
			chunkTokensUsed += tokens;
		}

		// -- Confidence score -------------------------------------------------
		const confidence =
			selectedChunks.length > 0
				? selectedChunks.reduce((sum, r) => sum + r.score, 0) /
					selectedChunks.length
				: 0;

		// -- Entities + conversation history (parallel fetch) -----------------
		const [allEntities, allMessages] = await Promise.all([
			db.select().from(entities).where(eq(entities.campaignId, campaignId)),
			conversationId
				? db
						.select()
						.from(messages)
						.where(eq(messages.conversationId, conversationId))
						.orderBy(desc(messages.createdAt))
				: Promise.resolve([] as (typeof messages.$inferSelect)[]),
		]);

		// -- Entities ---------------------------------------------------------
		const entityLines: string[] = [];
		let entityTokensUsed = 0;

		for (const entity of allEntities) {
			const line = formatEntity(entity);
			const tokens = estimateTokens(line);
			if (entityTokensUsed + tokens > entityBudget) break;
			entityLines.push(line);
			entityTokensUsed += tokens;
		}

		// -- Conversation history ---------------------------------------------
		// Fetch newest-first, accumulate until budget exhausted, then reverse
		// to restore chronological order. Oldest messages are dropped first.
		const selectedMessages: Array<{ role: string; content: string }> = [];

		let historyTokensUsed = 0;
		for (const msg of allMessages) {
			const tokens = estimateTokens(msg.content);
			if (historyTokensUsed + tokens > historyBudget) break;
			selectedMessages.push({ role: msg.role, content: msg.content });
			historyTokensUsed += tokens;
		}
		selectedMessages.reverse();

		// -- Assemble text ----------------------------------------------------
		const sections: string[] = [];

		const metadataText = formatCampaignMetadata(campaign);
		if (estimateTokens(metadataText) <= metadataBudget) {
			sections.push(metadataText);
		}

		if (selectedChunks.length > 0) {
			const lines = ["## Relevant Campaign Knowledge"];
			for (let i = 0; i < selectedChunks.length; i++) {
				const chunk = selectedChunks[i];
				if (!chunk) continue;
				lines.push(`\n[${i + 1}] ${chunk.content}`);
				if (chunk.sourceName) lines.push(`Source: ${chunk.sourceName}`);
			}
			sections.push(lines.join("\n"));
		}

		if (entityLines.length > 0) {
			sections.push(["## Campaign Entities", ...entityLines].join("\n"));
		}

		if (selectedMessages.length > 0) {
			const lines = ["## Recent Conversation"];
			for (const msg of selectedMessages) {
				const speaker = msg.role === "user" ? "User" : "Assistant";
				lines.push(`${speaker}: ${msg.content}`);
			}
			sections.push(lines.join("\n"));
		}

		const text = sections.join("\n\n");

		const citations: ContextCitation[] = selectedChunks.map((chunk) => ({
			chunkId: chunk.chunkId,
			sourceName: chunk.sourceName,
			sourceId: chunk.sourceId,
		}));

		return {
			text,
			citations,
			confidence,
			tokenCount: estimateTokens(text),
		};
	},
};
