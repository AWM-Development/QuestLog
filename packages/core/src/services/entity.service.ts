import type Anthropic from "@anthropic-ai/sdk";
import { ENTITY_TYPES, type EntityType } from "@questlog/shared";
import { and, eq, sql } from "drizzle-orm";
import type { Database, Transaction } from "../db/index.js";
import { entities } from "../db/schema/index.js";
import { NotFoundError } from "../lib/errors.js";
import { first } from "../lib/utils.js";
import { CONTEXT_CONFIG, contextService } from "./context.service.js";
import type { ContextCitation } from "./context.service.js";
import {
	rangesOverlap,
	tokenizeWords,
} from "./entity-candidate-detection.service.js";
import { llmService as defaultLlmService } from "./llm.service.js";
import type { LlmService } from "./llm.service.js";
import type { FetchFn } from "./voyage.client.js";

export interface EntitySpan {
	entityId: string;
	entityName: string;
	entityType: string;
	startIndex: number;
	endIndex: number;
	matchType: "confirmed" | "ambiguous";
	candidates: { id: string; name: string }[];
}

/** Widens `EntityType` with "unclassified" — see IMPLEMENTATION_NOTES.md § G-021 (T-119) for why this isn't added to `ENTITY_TYPES` itself. */
export type EntityCandidateEntityType = EntityType | "unclassified";

/** A proposed new entity from free text — not yet linked to a DB row. */
export interface EntityCandidateProposal {
	name: string;
	entityType: EntityCandidateEntityType;
	description: string;
	startIndex: number;
	endIndex: number;
}

interface DetectSpansInput {
	campaignId: string;
	text: string;
	dismissedEntityTexts?: string[];
}

interface DetectCandidatesInput {
	campaignId: string;
	text: string;
	/** Injectable structured-extraction client override (tests inject a mock; production defaults to the real client) — mirrors `createSeeded`'s `fetchFn` override for Voyage. */
	llmService?: Pick<LlmService, "callClaudeStructured">;
}

/** Raw shape returned by the structured-extraction call, before entityType validation. */
interface RawCandidateExtraction {
	name: string;
	entityType: string;
	description: string;
	startIndex: number;
	endIndex: number;
}

interface CandidateExtractionResult {
	candidates: RawCandidateExtraction[];
}

const CANDIDATE_EXTRACTION_SCHEMA_NAME = "propose_entity_candidates";

const CANDIDATE_EXTRACTION_PROMPT_PREAMBLE = `Identify every new named entity (NPC, location, faction, item, or story arc) mentioned in the document text below that is not already a known entity. For each one, report its name, a best-guess entityType, a one-sentence description drawn from the text, and the character start/end offsets of its first mention in the text. Use entityType "unclassified" only when the entity genuinely cannot be classified into any of ${ENTITY_TYPES.join(", ")}.`;

/** Marker separating the fixed preamble from the raw document text — exported so tests can recover the original text from a captured prompt without re-parsing arbitrary prompt structure. */
export const CANDIDATE_EXTRACTION_TEXT_MARKER = "\n\nDocument text:\n";

function buildCandidateExtractionPrompt(text: string): string {
	return `${CANDIDATE_EXTRACTION_PROMPT_PREAMBLE}${CANDIDATE_EXTRACTION_TEXT_MARKER}${text}`;
}

const CANDIDATE_EXTRACTION_SCHEMA: Anthropic.Tool.InputSchema = {
	type: "object",
	properties: {
		candidates: {
			type: "array",
			items: {
				type: "object",
				properties: {
					name: { type: "string" },
					entityType: {
						type: "string",
						enum: [...ENTITY_TYPES, "unclassified"],
					},
					description: { type: "string" },
					startIndex: { type: "number" },
					endIndex: { type: "number" },
				},
				required: [
					"name",
					"entityType",
					"description",
					"startIndex",
					"endIndex",
				],
			},
		},
	},
	required: ["candidates"],
};

function toCandidateEntityType(raw: string): EntityCandidateEntityType {
	return (ENTITY_TYPES as readonly string[]).includes(raw)
		? (raw as EntityType)
		: "unclassified";
}

interface EntityCandidate {
	id: string;
	name: string;
	type: string;
}

/**
 * Shared fuzzy-candidate predicate: rows whose name clears the low-threshold
 * word_similarity cutoff for a campaign. Callers select only the columns
 * they need onto this filter, fully Drizzle-typed so nobody hand-casts
 * columns out of Record<string, unknown>. Mirrors search.service.ts's
 * pattern of a raw `sql` fragment embedded inside the query builder rather
 * than a fully raw execute call.
 */
function wordSimilarityCandidateFilter(
	campaignId: string,
	query: string,
	excludeArchived = false,
) {
	return and(
		eq(entities.campaignId, campaignId),
		sql`word_similarity(${entities.name}, ${query}) > 0.15`,
		excludeArchived ? eq(entities.status, "active") : undefined,
	);
}

function escapeRegex(s: string): string {
	return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findExactPositions(
	entityName: string,
	text: string,
): Array<{ start: number; end: number }> {
	const pattern = new RegExp(escapeRegex(entityName), "gi");
	const results: Array<{ start: number; end: number }> = [];
	let result = pattern.exec(text);
	while (result !== null) {
		results.push({
			start: result.index,
			end: result.index + entityName.length,
		});
		result = pattern.exec(text);
	}
	return results;
}

// Pure-JS trigram similarity — same algorithm as pg_trgm similarity().
// Eliminates per-token DB round-trips that would otherwise be O(candidates × tokens).
function trigramSet(s: string): Set<string> {
	const padded = `  ${s.toLowerCase()} `;
	const grams = new Set<string>();
	for (let i = 0; i < padded.length - 2; i++) {
		grams.add(padded.slice(i, i + 3));
	}
	return grams;
}

function trigramSimilarity(a: string, b: string): number {
	const setA = trigramSet(a);
	const setB = trigramSet(b);
	if (setA.size === 0 && setB.size === 0) return 1;
	if (setA.size === 0 || setB.size === 0) return 0;
	let intersection = 0;
	for (const g of setA) {
		if (setB.has(g)) intersection++;
	}
	return (2 * intersection) / (setA.size + setB.size);
}

// Confirmation threshold for pure-JS trigram similarity, shared by detectSpans'
// fuzzy span matching and getByName's fuzzy name lookup.
const FUZZY_THRESHOLD = 0.4;

function findFuzzyPositions(
	entityName: string,
	text: string,
): Array<{ start: number; end: number }> {
	const entityWordCount = entityName.trim().split(/\s+/).length;
	const tokens = tokenizeWords(text);
	if (tokens.length === 0) return [];

	const results: Array<{ start: number; end: number }> = [];

	if (entityWordCount === 1) {
		for (const token of tokens) {
			if (trigramSimilarity(entityName, token.word) >= FUZZY_THRESHOLD) {
				results.push({ start: token.start, end: token.end });
			}
		}
	} else {
		for (let i = 0; i <= tokens.length - entityWordCount; i++) {
			const window = tokens.slice(i, i + entityWordCount);
			const first = window[0];
			const last = window[window.length - 1];
			if (!first || !last) continue;
			const windowText = text.slice(first.start, last.end);
			if (trigramSimilarity(entityName, windowText) >= FUZZY_THRESHOLD) {
				results.push({ start: first.start, end: last.end });
			}
		}
	}

	return results;
}

function isSentenceEndChar(ch: string | undefined): boolean {
	return ch === "." || ch === "!" || ch === "?";
}

/**
 * Extract the sentence surrounding a matched entity span, for the
 * deterministic consolidation excerpt (log_session's entity consolidation
 * step). Falls back to the whole text when no sentence boundary is found.
 */
export function extractExcerpt(
	text: string,
	span: { startIndex: number; endIndex: number },
): string {
	let start = 0;
	for (let i = span.startIndex - 1; i >= 0; i--) {
		if (isSentenceEndChar(text[i])) {
			start = i + 1;
			break;
		}
	}

	let end = text.length;
	for (let i = span.endIndex; i < text.length; i++) {
		if (isSentenceEndChar(text[i])) {
			end = i + 1;
			break;
		}
	}

	return text.slice(start, end).trim();
}

/**
 * Groups matching chunks by source and joins each source's excerpts into its
 * own labeled paragraph — surfaces a multi-source conflict instead of
 * silently blending voices into one paragraph (G-016).
 */
function buildSeededDraft(
	seedChunks: Array<{
		sourceId: string | null;
		sourceName: string | null;
		content: string;
	}>,
): string {
	const bySource = new Map<string, { label: string; excerpts: string[] }>();
	for (const chunk of seedChunks) {
		const key = chunk.sourceId ?? "unknown";
		const existing = bySource.get(key);
		if (existing) {
			existing.excerpts.push(chunk.content);
		} else {
			bySource.set(key, {
				label: chunk.sourceName ?? "Unknown source",
				excerpts: [chunk.content],
			});
		}
	}
	return Array.from(bySource.values())
		.map(({ label, excerpts }) => `${label}: ${excerpts.join(" ")}`)
		.join("\n");
}

// Named separately (rather than `Awaited<ReturnType<typeof entityService.create>>`)
// so `createSeeded`'s return type doesn't reference `entityService` from inside
// its own initializer — that circular reference made the whole object literal's
// inferred types collapse to `any`.
type EntityRow = typeof entities.$inferSelect;

export const entityService = {
	async detectSpans(
		db: Database,
		{ campaignId, text, dismissedEntityTexts = [] }: DetectSpansInput,
	): Promise<EntitySpan[]> {
		if (!text.trim()) return [];

		const dismissed = new Set(dismissedEntityTexts.map((t) => t.toLowerCase()));

		const candidateRows = await db
			.select({ id: entities.id, name: entities.name, type: entities.type })
			.from(entities)
			.where(wordSimilarityCandidateFilter(campaignId, text, true));

		if (candidateRows.length === 0) return [];

		const positionMap = new Map<string, EntityCandidate[]>();

		for (const row of candidateRows) {
			const entity: EntityCandidate = {
				id: row.id,
				name: row.name,
				type: row.type,
			};
			let positions = findExactPositions(entity.name, text);
			if (positions.length === 0) {
				positions = findFuzzyPositions(entity.name, text);
			}
			for (const pos of positions) {
				const key = `${pos.start}:${pos.end}`;
				const existing = positionMap.get(key) ?? [];
				existing.push(entity);
				positionMap.set(key, existing);
			}
		}

		if (positionMap.size === 0) return [];

		const candidates = Array.from(positionMap.entries()).map(
			([key, entityList]) => {
				const [startStr, endStr] = key.split(":");
				return {
					start: Number(startStr),
					end: Number(endStr),
					entities: entityList,
				};
			},
		);

		candidates.sort((a, b) => {
			const lenDiff = b.end - b.start - (a.end - a.start);
			if (lenDiff !== 0) return lenDiff;
			return a.start - b.start;
		});

		const spans: EntitySpan[] = [];
		const coveredRanges: Array<[number, number]> = [];

		for (const candidate of candidates) {
			const overlaps = coveredRanges.some(
				([s, e]) => candidate.start < e && candidate.end > s,
			);
			if (overlaps) continue;

			const matchedText = text.slice(candidate.start, candidate.end);
			if (dismissed.has(matchedText.toLowerCase())) continue;

			coveredRanges.push([candidate.start, candidate.end]);

			const first = candidate.entities[0];
			if (!first) continue;

			if (candidate.entities.length === 1) {
				spans.push({
					entityId: first.id,
					entityName: first.name,
					entityType: first.type,
					startIndex: candidate.start,
					endIndex: candidate.end,
					matchType: "confirmed",
					candidates: [],
				});
			} else {
				spans.push({
					entityId: first.id,
					entityName: first.name,
					entityType: first.type,
					startIndex: candidate.start,
					endIndex: candidate.end,
					matchType: "ambiguous",
					candidates: candidate.entities.map((e) => ({
						id: e.id,
						name: e.name,
					})),
				});
			}
		}

		return spans.sort((a, b) => a.startIndex - b.startIndex);
	},

	async detectCandidates(
		db: Database,
		{ campaignId, text, llmService = defaultLlmService }: DetectCandidatesInput,
	): Promise<EntityCandidateProposal[]> {
		if (!text.trim()) return [];

		const existingSpans = await entityService.detectSpans(db, {
			campaignId,
			text,
		});
		const covered = existingSpans.map((s) => ({
			start: s.startIndex,
			end: s.endIndex,
		}));

		const { data } =
			await llmService.callClaudeStructured<CandidateExtractionResult>({
				prompt: buildCandidateExtractionPrompt(text),
				schemaName: CANDIDATE_EXTRACTION_SCHEMA_NAME,
				schema: CANDIDATE_EXTRACTION_SCHEMA,
				schemaDescription:
					"Structured list of new-entity candidates proposed from the document text.",
			});

		const proposals: EntityCandidateProposal[] = [];
		const seenNames = new Set<string>();
		for (const raw of data.candidates ?? []) {
			const span = { start: raw.startIndex, end: raw.endIndex };
			if (covered.some((c) => rangesOverlap(c, span))) continue;

			// Same name mentioned more than once in one document proposes only
			// once, keyed off its first (earliest) occurrence — otherwise a
			// document mentioning "Vespera Nightveil" twice would stage two
			// candidates for confirmation instead of one.
			if (seenNames.has(raw.name)) continue;
			seenNames.add(raw.name);

			proposals.push({
				name: raw.name,
				entityType: toCandidateEntityType(raw.entityType),
				description: raw.description,
				startIndex: raw.startIndex,
				endIndex: raw.endIndex,
			});
		}

		return proposals;
	},

	async create(
		db: Database | Transaction,
		input: {
			campaignId: string;
			name: string;
			type: string;
			description?: string;
			sourceId?: string;
			attributes?: Record<string, unknown>;
		},
	) {
		const rows = await db
			.insert(entities)
			.values({
				campaignId: input.campaignId,
				name: input.name,
				type: input.type,
				description: input.description ?? null,
				sourceId: input.sourceId ?? null,
				attributes: input.attributes ?? {},
			})
			.returning();
		const row = rows[0];
		if (!row) throw new Error("Entity creation failed");
		return row;
	},

	/**
	 * `create_entity`'s lore-seeding variant (T-083, G-016): searches ingested
	 * lore for the entity's name before persisting, and drafts a description
	 * from any match that clears `CONTEXT_CONFIG.seedConfidenceThreshold`. A
	 * caller-supplied description is never overwritten — the draft is
	 * appended as a separate, labeled section instead. Below threshold, the
	 * entity is created exactly as `create` would, but the search results
	 * still come back as citations so nothing found is silently discarded.
	 */
	async createSeeded(
		db: Database,
		input: {
			campaignId: string;
			name: string;
			type: string;
			description?: string;
			fetchFn?: FetchFn;
		},
	): Promise<{
		entity: EntityRow;
		citations: ContextCitation[];
		confidence: number;
		seeded: boolean;
	}> {
		const results = await contextService.searchChunks(db, {
			campaignId: input.campaignId,
			// `type` is a hint appended to the query text, not a hard filter —
			// mirrors context.service.ts's formatEntity line shape.
			query: `${input.name} (${input.type})`,
			fetchFn: input.fetchFn,
		});

		// searchChunks sorts by combinedScore (recency-blended, T-082), so
		// results[0] isn't necessarily the chunk with the highest raw score —
		// gate on the max raw score across all results, not array position.
		const confidence = results.reduce((max, r) => Math.max(max, r.score), 0);
		const seeded = confidence >= CONTEXT_CONFIG.seedConfidenceThreshold;

		const citations: ContextCitation[] = results.map((r) => ({
			chunkId: r.chunkId,
			sourceName: r.sourceName,
			sourceId: r.sourceId,
		}));

		let description = input.description;
		let attributes: Record<string, unknown> | undefined;

		if (seeded) {
			const seedChunks = results.filter(
				(r) => r.score >= CONTEXT_CONFIG.seedConfidenceThreshold,
			);
			const draft = buildSeededDraft(seedChunks);
			description = input.description
				? `${input.description}\n\n---\nSeeded from lore:\n${draft}`
				: draft;
			attributes = {
				seededFrom: {
					chunkIds: seedChunks.map((c) => c.chunkId),
					confidence,
				},
			};
		}

		const entity = await entityService.create(db, {
			campaignId: input.campaignId,
			name: input.name,
			type: input.type,
			description,
			attributes,
		});

		return { entity, citations, confidence, seeded };
	},

	async update(
		db: Database | Transaction,
		input: {
			id: string;
			campaignId: string;
			name?: string;
			type?: string;
			description?: string;
		},
	) {
		const { id, campaignId, ...fields } = input;

		const updateData: Record<string, unknown> = {};
		if ("name" in fields) updateData.name = fields.name;
		if ("type" in fields) updateData.type = fields.type;
		if ("description" in fields) updateData.description = fields.description;

		if (Object.keys(updateData).length === 0) {
			const rows = await db
				.select()
				.from(entities)
				.where(and(eq(entities.id, id), eq(entities.campaignId, campaignId)));
			const row = rows[0];
			if (!row) throw new NotFoundError("Entity", id);
			return row;
		}

		const rows = await db
			.update(entities)
			.set(updateData)
			.where(and(eq(entities.id, id), eq(entities.campaignId, campaignId)))
			.returning();

		if (rows.length === 0) {
			throw new NotFoundError("Entity", id);
		}
		return first(rows);
	},

	async list(
		db: Database,
		campaignId: string,
		type?: string,
		includeArchived = false,
	) {
		return db
			.select()
			.from(entities)
			.where(
				and(
					eq(entities.campaignId, campaignId),
					type ? eq(entities.type, type) : undefined,
					includeArchived ? undefined : eq(entities.status, "active"),
				),
			);
	},

	async getById(db: Database, campaignId: string, entityId: string) {
		const rows = await db
			.select()
			.from(entities)
			.where(
				and(eq(entities.id, entityId), eq(entities.campaignId, campaignId)),
			);
		const row = rows[0];
		if (!row) throw new NotFoundError("Entity", entityId);
		return row;
	},

	async getByName(
		db: Database,
		campaignId: string,
		name: string,
		includeArchived = false,
	) {
		const candidateRows = await db
			.select()
			.from(entities)
			.where(wordSimilarityCandidateFilter(campaignId, name, !includeArchived));

		let best: { row: (typeof candidateRows)[number]; score: number } | null =
			null;
		for (const row of candidateRows) {
			const score = trigramSimilarity(name, row.name);
			if (score >= FUZZY_THRESHOLD && (!best || score > best.score)) {
				best = { row, score };
			}
		}
		if (!best) throw new NotFoundError("Entity", name);

		return best.row;
	},

	async archive(
		db: Database | Transaction,
		campaignId: string,
		entityId: string,
	) {
		const rows = await db
			.update(entities)
			.set({ status: "archived" })
			.where(
				and(eq(entities.id, entityId), eq(entities.campaignId, campaignId)),
			)
			.returning();
		const row = rows[0];
		if (!row) throw new NotFoundError("Entity", entityId);
		return row;
	},

	async unarchive(
		db: Database | Transaction,
		campaignId: string,
		entityId: string,
	) {
		const rows = await db
			.update(entities)
			.set({ status: "active" })
			.where(
				and(eq(entities.id, entityId), eq(entities.campaignId, campaignId)),
			)
			.returning();
		const row = rows[0];
		if (!row) throw new NotFoundError("Entity", entityId);
		return row;
	},

	async countByCampaign(db: Database, campaignId: string): Promise<number> {
		const result = await db.execute<{ count: string }>(
			sql`SELECT count(*)::int AS count FROM entities WHERE campaign_id = ${campaignId}`,
		);
		return Number((result[0] as { count: string } | undefined)?.count ?? 0);
	},

	/**
	 * Append a deterministic excerpt to an entity's description (append, never
	 * overwrite) — the log_session consolidation step's write path.
	 */
	async appendToDescription(
		db: Database | Transaction,
		entityId: string,
		note: string,
	) {
		const rows = await db
			.select({ description: entities.description })
			.from(entities)
			.where(eq(entities.id, entityId));
		const row = rows[0];
		if (!row) throw new NotFoundError("Entity", entityId);

		const updated = row.description?.trim()
			? `${row.description.trim()}\n\n${note}`
			: note;

		const updatedRows = await db
			.update(entities)
			.set({ description: updated })
			.where(eq(entities.id, entityId))
			.returning();
		return first(updatedRows);
	},
};
