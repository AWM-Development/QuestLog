import type Anthropic from "@anthropic-ai/sdk";
import { and, eq, ne, sql } from "drizzle-orm";
import type { Database } from "../db/index.js";
import { chunks } from "../db/schema/index.js";
import { entityService } from "./entity.service.js";
import { llmService as defaultLlmService } from "./llm.service.js";
import type { LlmService } from "./llm.service.js";

/**
 * Confidence-gated filtering per G-031's resolution: moderate tolerance, not
 * "surface everything" (too noisy to triage) or "only certainties" (misses
 * real but non-obvious contradictions). Starting constant, not derived from
 * an eval harness — same caveat entity.service.ts's candidate-extraction
 * heuristic notes (G-021).
 */
export const CONTRADICTION_CONFIDENCE_THRESHOLD = 0.6;

/** A proposed factual contradiction between new document text and an existing entity's lore. */
export interface ContradictionCandidate {
	entityId: string;
	entityName: string;
	newClaimExcerpt: string;
	existingClaimExcerpt: string;
	confidence: number;
}

interface DetectContradictionsInput {
	campaignId: string;
	text: string;
	/** Injectable structured-extraction client override (tests inject a mock; production defaults to the real client) — mirrors entity.service.ts's detectCandidates. */
	llmService?: Pick<LlmService, "callClaudeStructured">;
}

interface RawContradiction {
	entityId: string;
	newClaimExcerpt: string;
	existingClaimExcerpt: string;
	confidence: number;
}

interface ContradictionExtractionResult {
	contradictions: RawContradiction[];
}

const CONTRADICTION_SCHEMA_NAME = "report_contradictions";

const CONTRADICTION_SCHEMA: Anthropic.Tool.InputSchema = {
	type: "object",
	properties: {
		contradictions: {
			type: "array",
			items: {
				type: "object",
				properties: {
					entityId: { type: "string" },
					newClaimExcerpt: { type: "string" },
					existingClaimExcerpt: { type: "string" },
					confidence: { type: "number" },
				},
				required: [
					"entityId",
					"newClaimExcerpt",
					"existingClaimExcerpt",
					"confidence",
				],
			},
		},
	},
	required: ["contradictions"],
};

/** Max non-superseded chunks pulled per entity as extra lore context, beyond its own description. */
const LORE_CHUNK_LIMIT = 5;

/**
 * Existing lore for one matched entity: its canonical description plus any
 * non-superseded chunks whose content mentions it by name — a direct,
 * deterministic DB lookup (trigram-indexed `chunks.content`), not an
 * embedding search, since this only needs "does this chunk mention the
 * entity," not semantic similarity (search.service.ts's `search` is for the
 * latter).
 */
async function getEntityLore(
	db: Database,
	campaignId: string,
	entityName: string,
): Promise<string[]> {
	const rows = await db
		.select({ content: chunks.content })
		.from(chunks)
		.where(
			and(
				eq(chunks.campaignId, campaignId),
				ne(chunks.status, "superseded"),
				sql`${chunks.content} ILIKE ${`%${entityName}%`}`,
			),
		)
		.limit(LORE_CHUNK_LIMIT);
	return rows.map((row) => row.content);
}

function buildContradictionPrompt(
	text: string,
	entities: Array<{ id: string; name: string; existingLore: string[] }>,
): string {
	const entityBlocks = entities
		.map((entity) => {
			const lore = entity.existingLore.length
				? entity.existingLore.join("\n")
				: "(no existing lore recorded)";
			return `Entity ID: ${entity.id}\nName: ${entity.name}\nExisting lore:\n${lore}`;
		})
		.join("\n\n");

	return `Compare the new document text below against each listed entity's existing lore. Report any factual contradiction — a claim in the new text that conflicts with a claim already recorded for that entity (e.g. described as dead in existing lore but referenced as alive in the new text). For each contradiction found, report the entity's exact Entity ID, a short excerpt of the new text's contradicting claim, a short excerpt of the existing lore's conflicting claim, and a confidence score (0-1). Report nothing for entities with no contradiction.

Entities:
${entityBlocks}

New document text:
${text}`;
}

export const continuityService = {
	/**
	 * Detects likely factual contradictions between `text` and the existing
	 * lore of entities it mentions — G-031's resolution. Mirrors
	 * `entityService.detectCandidates`'s shape: reuse `detectSpans`'s
	 * existing-entity matching (no new NLP span-detection needed), one
	 * `callClaudeStructured` call per document (not per entity), then
	 * confidence-gated filtering.
	 */
	async detectContradictions(
		db: Database,
		{
			campaignId,
			text,
			llmService = defaultLlmService,
		}: DetectContradictionsInput,
	): Promise<ContradictionCandidate[]> {
		if (!text.trim()) return [];

		const spans = await entityService.detectSpans(db, { campaignId, text });
		const matchedIds = [...new Set(spans.map((span) => span.entityId))];
		if (matchedIds.length === 0) return [];

		const matchedEntities = await Promise.all(
			matchedIds.map(async (entityId) => {
				const entity = await entityService.getById(db, campaignId, entityId);
				const loreChunks = await getEntityLore(db, campaignId, entity.name);
				const existingLore = entity.description
					? [entity.description, ...loreChunks]
					: loreChunks;
				return { id: entity.id, name: entity.name, existingLore };
			}),
		);

		const { data } =
			await llmService.callClaudeStructured<ContradictionExtractionResult>({
				prompt: buildContradictionPrompt(text, matchedEntities),
				schemaName: CONTRADICTION_SCHEMA_NAME,
				schema: CONTRADICTION_SCHEMA,
				schemaDescription:
					"Structured list of factual contradictions detected between the new document text and existing entity lore.",
			});

		const entityById = new Map(
			matchedEntities.map((entity) => [entity.id, entity]),
		);
		const candidates: ContradictionCandidate[] = [];
		for (const raw of data.contradictions ?? []) {
			if (raw.confidence < CONTRADICTION_CONFIDENCE_THRESHOLD) continue;
			const entity = entityById.get(raw.entityId);
			// Guard against a hallucinated entityId the model didn't actually receive.
			if (!entity) continue;
			candidates.push({
				entityId: entity.id,
				entityName: entity.name,
				newClaimExcerpt: raw.newClaimExcerpt,
				existingClaimExcerpt: raw.existingClaimExcerpt,
				confidence: raw.confidence,
			});
		}
		return candidates;
	},
};
