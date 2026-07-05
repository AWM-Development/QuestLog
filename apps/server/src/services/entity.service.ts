import { eq, sql } from "drizzle-orm";
import type { Database } from "../db/index.js";
import { entities } from "../db/schema/index.js";

export interface EntitySpan {
	entityId: string;
	entityName: string;
	entityType: string;
	startIndex: number;
	endIndex: number;
	matchType: "confirmed" | "ambiguous";
	candidates: { id: string; name: string }[];
}

interface DetectSpansInput {
	campaignId: string;
	text: string;
	dismissedEntityTexts?: string[];
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

function findFuzzyPositions(
	entityName: string,
	text: string,
): Array<{ start: number; end: number }> {
	const entityWordCount = entityName.trim().split(/\s+/).length;
	const tokens = tokenizeWords(text);
	if (tokens.length === 0) return [];

	const results: Array<{ start: number; end: number }> = [];
	const FUZZY_THRESHOLD = 0.4;

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

export const entityService = {
	async detectSpans(
		db: Database,
		{ campaignId, text, dismissedEntityTexts = [] }: DetectSpansInput,
	): Promise<EntitySpan[]> {
		if (!text.trim()) return [];

		const dismissed = new Set(dismissedEntityTexts.map((t) => t.toLowerCase()));

		const candidateRows = await db.execute<Record<string, unknown>>(sql`
      SELECT id, name, type
      FROM ${entities}
      WHERE campaign_id = ${campaignId}
        AND word_similarity(name, ${text}) > 0.15
    `);

		if (candidateRows.length === 0) return [];

		const positionMap = new Map<string, EntityCandidate[]>();

		for (const row of candidateRows) {
			const entity: EntityCandidate = {
				id: row.id as string,
				name: row.name as string,
				type: row.type as string,
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

	async list(db: Database, campaignId: string) {
		return db
			.select()
			.from(entities)
			.where(eq(entities.campaignId, campaignId));
	},
};
