import { ENTITY_TYPES, type EntityType } from "@questlog/shared";
import { and, eq, sql } from "drizzle-orm";
import type { Database, Transaction } from "../db/index.js";
import { entities } from "../db/schema/index.js";
import { NotFoundError } from "../lib/errors.js";
import { first } from "../lib/utils.js";

export interface EntitySpan {
	entityId: string;
	entityName: string;
	entityType: string;
	startIndex: number;
	endIndex: number;
	matchType: "confirmed" | "ambiguous";
	candidates: { id: string; name: string }[];
}

/** A proposed new entity from free text — not yet linked to a DB row. */
export interface EntityCandidateProposal {
	name: string;
	entityType: EntityType;
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
}

interface EntityCandidate {
	id: string;
	name: string;
	type: string;
}

interface TextToken {
	word: string;
	start: number;
	end: number;
}

/** Lowercase connectors allowed inside a multi-word proper-noun span. */
const NAME_CONNECTORS = new Set([
	"of",
	"the",
	"de",
	"van",
	"von",
	"da",
	"di",
	"and",
]);

/** Capitalized tokens that are never entity names on their own. */
const CAPITALIZED_STOPWORDS = new Set([
	"The",
	"A",
	"An",
	"And",
	"But",
	"Or",
	"So",
	"For",
	"Nor",
	"Yet",
	"They",
	"Them",
	"Their",
	"This",
	"That",
	"These",
	"Those",
	"There",
	"Then",
	"Thus",
	"When",
	"Where",
	"What",
	"Who",
	"How",
	"Why",
	"With",
	"From",
	"Into",
	"Onto",
	"Upon",
	"After",
	"Before",
	"During",
	"Throughout",
	"Thereafter",
	"Meanwhile",
	"However",
	"Also",
	"Once",
	"While",
	"Although",
	"Because",
	"Since",
	"Until",
	"Unless",
	"Though",
	"Still",
	"Even",
	"Only",
	"Just",
	"Almost",
	"About",
	"Above",
	"Below",
	"Under",
	"Over",
	"Between",
	"Among",
	"Against",
	"Toward",
	"Towards",
	"Through",
	"Across",
	"Behind",
	"Beside",
	"Beyond",
	"Inside",
	"Outside",
	"Within",
	"Without",
]);

/**
 * Shared fuzzy-candidate predicate: rows whose name clears the low-threshold
 * word_similarity cutoff for a campaign. Callers select only the columns
 * they need onto this filter, fully Drizzle-typed so nobody hand-casts
 * columns out of Record<string, unknown>. Mirrors search.service.ts's
 * pattern of a raw `sql` fragment embedded inside the query builder rather
 * than a fully raw execute call.
 */
function wordSimilarityCandidateFilter(campaignId: string, query: string) {
	return and(
		eq(entities.campaignId, campaignId),
		sql`word_similarity(${entities.name}, ${query}) > 0.15`,
	);
}

function escapeRegex(s: string): string {
	return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function tokenizeWords(text: string): TextToken[] {
	const tokens: TextToken[] = [];
	const regex = /\S+/g;
	let result = regex.exec(text);
	while (result !== null) {
		tokens.push({
			word: result[0],
			start: result.index,
			end: result.index + result[0].length,
		});
		result = regex.exec(text);
	}
	return tokens;
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

function tokenCore(word: string): {
	core: string;
	leading: number;
	trailing: number;
} {
	const leading = word.match(/^[^\p{L}\p{N}]*/u)?.[0].length ?? 0;
	const trailing = word.match(/[^\p{L}\p{N}]*$/u)?.[0].length ?? 0;
	const core =
		trailing > 0
			? word.slice(leading, word.length - trailing)
			: word.slice(leading);
	return { core, leading, trailing };
}

function isCapitalizedCore(core: string): boolean {
	if (!core) return false;
	const first = core[0];
	if (!first) return false;
	return first === first.toUpperCase() && first !== first.toLowerCase();
}

/**
 * Heuristic type guess from the name itself and a short window of preceding
 * text — no NLP dependency; mirrors detectSpans' trigram-only toolkit.
 */
function guessEntityType(
	text: string,
	span: { startIndex: number; endIndex: number; name: string },
): EntityType {
	const before = text.slice(Math.max(0, span.startIndex - 48), span.startIndex);
	const name = span.name;

	if (
		/\b(?:Castle|City|Town|Village|Temple|Forest|Keep|Tower|Lake|River|Mountain|Harbor|Isle)\b/i.test(
			name,
		) ||
		/\b(?:at|in|to|from|near|entered|left|reached|traveled\s+to)\s+(?:the\s+)?$/i.test(
			before,
		)
	) {
		return "location";
	}
	if (
		/\b(?:Guild|Order|Clan|Company|Brotherhood|Cult|House|Legion|Circle)\b/i.test(
			name,
		) ||
		/\b(?:joined|allied\s+with|members\s+of|fought)\s+(?:the\s+)?$/i.test(
			before,
		)
	) {
		return "faction";
	}
	if (
		/\b(?:Sword|Blade|Amulet|Ring|Staff|Shield|Armor|Crown|Orb|Sunblade|Dagger|Bow|Wand)\b/i.test(
			name,
		) ||
		/\b(?:wielded|carried|found|held|drew|took|looted|equipped)\s+(?:the\s+)?$/i.test(
			before,
		)
	) {
		return "item";
	}
	if (
		/\b(?:Prophecy|Quest|War|Curse|Campaign|Crisis|Saga|Conspiracy)\b/i.test(
			name,
		) ||
		/\b(?:began|during|throughout)\s+(?:the\s+)?$/i.test(before)
	) {
		return "arc";
	}
	if (
		/\b(?:met|saw|spoke\s+(?:to|with)|asked|told|killed|confronted|visited|greeted)\s+(?:the\s+)?$/i.test(
			before,
		)
	) {
		return "npc";
	}
	return "npc";
}

function rangesOverlap(
	a: { start: number; end: number },
	b: { start: number; end: number },
): boolean {
	return a.start < b.end && a.end > b.start;
}

/**
 * Find proper-noun-like capitalized spans in free text. Multi-word names may
 * include lowercase connectors (of/the/…). Longer spans win over overlapping
 * shorter ones — same preference detectSpans uses for entity matches.
 */
function findProperNounSpans(
	text: string,
): Array<{ name: string; start: number; end: number }> {
	const tokens = tokenizeWords(text);
	if (tokens.length === 0) return [];

	type Annotated = TextToken & {
		core: string;
		coreStart: number;
		coreEnd: number;
	};
	const annotated: Annotated[] = tokens.map((token) => {
		const { core, leading, trailing } = tokenCore(token.word);
		return {
			...token,
			core,
			coreStart: token.start + leading,
			coreEnd: token.end - trailing,
		};
	});

	const raw: Array<{ name: string; start: number; end: number }> = [];

	for (let i = 0; i < annotated.length; i++) {
		const first = annotated[i];
		if (!first || !isCapitalizedCore(first.core)) continue;
		if (CAPITALIZED_STOPWORDS.has(first.core)) continue;

		let endIdx = i;
		let j = i + 1;
		while (j < annotated.length) {
			const next = annotated[j];
			if (!next) break;
			if (
				isCapitalizedCore(next.core) &&
				!CAPITALIZED_STOPWORDS.has(next.core)
			) {
				endIdx = j;
				j++;
				continue;
			}
			if (NAME_CONNECTORS.has(next.core.toLowerCase())) {
				const after = annotated[j + 1];
				if (
					after &&
					isCapitalizedCore(after.core) &&
					!CAPITALIZED_STOPWORDS.has(after.core)
				) {
					endIdx = j + 1;
					j += 2;
					continue;
				}
			}
			break;
		}

		const startTok = annotated[i];
		const endTok = annotated[endIdx];
		if (!startTok || !endTok) continue;

		const name = text.slice(startTok.coreStart, endTok.coreEnd);
		if (!name.trim()) continue;

		raw.push({ name, start: startTok.coreStart, end: endTok.coreEnd });
		i = endIdx;
	}

	raw.sort((a, b) => {
		const lenDiff = b.end - b.start - (a.end - a.start);
		if (lenDiff !== 0) return lenDiff;
		return a.start - b.start;
	});

	const accepted: Array<{ name: string; start: number; end: number }> = [];
	for (const span of raw) {
		if (accepted.some((a) => rangesOverlap(a, span))) continue;
		accepted.push(span);
	}
	return accepted.sort((a, b) => a.start - b.start);
}

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
			.where(wordSimilarityCandidateFilter(campaignId, text));

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
		{ campaignId, text }: DetectCandidatesInput,
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

		const proposals: EntityCandidateProposal[] = [];
		for (const span of findProperNounSpans(text)) {
			if (covered.some((c) => rangesOverlap(c, span))) continue;

			const entityType = guessEntityType(text, {
				startIndex: span.start,
				endIndex: span.end,
				name: span.name,
			});
			if (!(ENTITY_TYPES as readonly string[]).includes(entityType)) continue;

			proposals.push({
				name: span.name,
				entityType,
				description: extractExcerpt(text, {
					startIndex: span.start,
					endIndex: span.end,
				}),
				startIndex: span.start,
				endIndex: span.end,
			});
		}

		return proposals;
	},

	async create(
		db: Database,
		input: {
			campaignId: string;
			name: string;
			type: string;
			description?: string;
		},
	) {
		const rows = await db
			.insert(entities)
			.values({
				campaignId: input.campaignId,
				name: input.name,
				type: input.type,
				description: input.description ?? null,
			})
			.returning();
		const row = rows[0];
		if (!row) throw new Error("Entity creation failed");
		return row;
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

	async list(db: Database, campaignId: string, type?: string) {
		return db
			.select()
			.from(entities)
			.where(
				type
					? and(eq(entities.campaignId, campaignId), eq(entities.type, type))
					: eq(entities.campaignId, campaignId),
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

	async getByName(db: Database, campaignId: string, name: string) {
		const candidateRows = await db
			.select()
			.from(entities)
			.where(wordSimilarityCandidateFilter(campaignId, name));

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
