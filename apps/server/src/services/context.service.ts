/**
 * Context assembly service: builds an LLM context window for a campaign query.
 *
 * Sources assembled (in order of text appearance):
 *   1. Campaign metadata — name, description, game system, theme
 *   2. Relevant chunks  — top-k results from vector search, re-ranked with recency
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
 * Confidence score: average cosine similarity of the chunks included in the context.
 */

import { desc, eq } from "drizzle-orm";
import type { Database } from "../db/index.js";
import { campaigns, entities, messages } from "../db/schema/index.js";
import { NotFoundError } from "../lib/errors.js";
import type { SearchResult } from "./search.service.js";
import { searchService } from "./search.service.js";

type FetchFn = typeof globalThis.fetch;

// ---------------------------------------------------------------------------
// Budget constants
// ---------------------------------------------------------------------------
const DEFAULT_TOKEN_BUDGET = 100_000;
const DEFAULT_SEARCH_LIMIT = 20;
const CHUNK_BUDGET_RATIO = 0.6;
const HISTORY_BUDGET_RATIO = 0.25;
const ENTITY_BUDGET_RATIO = 0.1;
const METADATA_BUDGET_RATIO = 0.05;

/** Fraction of combined score contributed by recency (0–1). */
const RECENCY_WEIGHT = 0.1;

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
	/** Number of candidate chunks to retrieve before budget trimming. Default: 20. */
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

/** Rough token estimate: ~1.33 tokens per whitespace-delimited word. */
function estimateTokens(text: string): number {
	return Math.ceil(text.split(/\s+/).filter(Boolean).length / 0.75);
}

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
			(1 - RECENCY_WEIGHT) * r.score + RECENCY_WEIGHT * recencyScore;
		return { ...r, combinedScore };
	});

	scored.sort((a, b) => b.combinedScore - a.combinedScore);
	return scored;
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
			tokenBudget = DEFAULT_TOKEN_BUDGET,
			searchLimit = DEFAULT_SEARCH_LIMIT,
		} = input;
		const fetchFn = input.fetchFn ?? globalThis.fetch;

		// -- Budget allocation ------------------------------------------------
		const chunkBudget = Math.floor(tokenBudget * CHUNK_BUDGET_RATIO);
		const historyBudget = Math.floor(tokenBudget * HISTORY_BUDGET_RATIO);
		const entityBudget = Math.floor(tokenBudget * ENTITY_BUDGET_RATIO);
		const metadataBudget = Math.floor(tokenBudget * METADATA_BUDGET_RATIO);

		// -- Campaign metadata ------------------------------------------------
		const [campaign] = await db
			.select()
			.from(campaigns)
			.where(eq(campaigns.id, campaignId));

		if (!campaign) throw new NotFoundError("Campaign", campaignId);

		// -- Vector search + recency re-ranking --------------------------------
		const rawResults = await searchService.search(db, {
			campaignId,
			query,
			limit: searchLimit,
			fetchFn,
		});

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

		// -- Entities ---------------------------------------------------------
		const allEntities = await db
			.select()
			.from(entities)
			.where(eq(entities.campaignId, campaignId));

		const selectedEntities: typeof allEntities = [];
		let entityTokensUsed = 0;

		for (const entity of allEntities) {
			const text = formatEntity(entity);
			const tokens = estimateTokens(text);
			if (entityTokensUsed + tokens > entityBudget) break;
			selectedEntities.push(entity);
			entityTokensUsed += tokens;
		}

		// -- Conversation history ---------------------------------------------
		// Fetch newest-first, accumulate until budget exhausted, then reverse
		// to restore chronological order. Oldest messages are dropped first.
		const selectedMessages: Array<{ role: string; content: string }> = [];

		if (conversationId) {
			const allMessages = await db
				.select()
				.from(messages)
				.where(eq(messages.conversationId, conversationId))
				.orderBy(desc(messages.createdAt));

			let historyTokensUsed = 0;
			for (const msg of allMessages) {
				const tokens = estimateTokens(msg.content);
				if (historyTokensUsed + tokens > historyBudget) break;
				selectedMessages.push({ role: msg.role, content: msg.content });
				historyTokensUsed += tokens;
			}
			selectedMessages.reverse();
		}

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

		if (selectedEntities.length > 0) {
			const lines = ["## Campaign Entities"];
			for (const entity of selectedEntities) {
				lines.push(formatEntity(entity));
			}
			sections.push(lines.join("\n"));
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
