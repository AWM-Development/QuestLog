/**
 * Text chunking for the RAG pipeline.
 *
 * Splits extracted text into chunks of ~500–800 tokens using a word-count
 * heuristic (1 token ≈ 0.75 words → target 650–1000 words per chunk).
 * Respects section boundaries: headings (# / ##) and double-newline paragraph
 * breaks are preferred split points before falling back to word count.
 */

/** Target and maximum word counts per chunk. */
const TARGET_WORDS = 800;
const MAX_WORDS = 1000;

/** Pattern that identifies a section boundary: heading or double-newline. */
const SECTION_BOUNDARY = /\n(?=#{1,6}\s)|\n{2,}/;

export type ChunkMeta = { campaignId: string } & (
	| { sourceId: string; sessionId?: undefined }
	| { sessionId: string; sourceId?: undefined }
);

export type TextChunk = { content: string; position: number } & ChunkMeta;

/**
 * Split text into semantically-bounded chunks.
 * Returns an empty array for empty/whitespace-only input.
 */
export function chunkText(text: string, meta: ChunkMeta): TextChunk[] {
	if (!text.trim()) return [];

	// Split on section boundaries (headings, double-newlines)
	const sections = text.split(SECTION_BOUNDARY).filter((s) => s.trim());

	const chunks: TextChunk[] = [];
	let currentContent = "";
	let currentWordCount = 0;

	const flush = () => {
		const trimmed = currentContent.trim();
		if (trimmed) {
			chunks.push({
				...meta,
				content: trimmed,
				position: chunks.length,
			});
		}
		currentContent = "";
		currentWordCount = 0;
	};

	for (const section of sections) {
		const sectionWords = countWords(section);
		const startsWithHeading = /^#{1,6}\s/.test(section.trimStart());

		// If a single section exceeds max, split it by word count
		if (sectionWords > MAX_WORDS) {
			if (currentContent.trim()) flush();
			const subChunks = splitByWordCount(section);
			for (const sub of subChunks) {
				currentContent = sub;
				currentWordCount = countWords(sub);
				flush();
			}
			continue;
		}

		// Headings always start a new chunk
		if (startsWithHeading && currentContent.trim()) {
			flush();
		}

		// If adding this section would exceed max, flush first
		if (currentWordCount + sectionWords > MAX_WORDS && currentContent.trim()) {
			flush();
		}

		// Append section to current buffer
		if (currentContent) {
			currentContent += `\n\n${section}`;
		} else {
			currentContent = section;
		}
		currentWordCount += sectionWords;

		// If we've hit the target, flush
		if (currentWordCount >= TARGET_WORDS) {
			flush();
		}
	}

	// Flush remaining content
	flush();

	return chunks;
}

function countWords(text: string): number {
	return text.split(/\s+/).filter(Boolean).length;
}

/** Split a long block of text into chunks by word count. */
function splitByWordCount(text: string): string[] {
	const words = text.split(/\s+/).filter(Boolean);
	const result: string[] = [];

	for (let i = 0; i < words.length; i += TARGET_WORDS) {
		result.push(words.slice(i, i + TARGET_WORDS).join(" "));
	}

	return result;
}
