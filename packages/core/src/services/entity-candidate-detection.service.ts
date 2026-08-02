/**
 * Pure text-processing heuristics for proper-noun-span detection and
 * type classification — no DB dependency, mirrors chunking.service.ts's
 * precedent of keeping this shape of logic out of a DB-facing *.service.ts.
 */

import type { EntityType } from "@questlog/shared";

export interface TextToken {
	word: string;
	start: number;
	end: number;
}

export function tokenizeWords(text: string): TextToken[] {
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
export function guessEntityType(
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

export function rangesOverlap(
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
export function findProperNounSpans(
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
