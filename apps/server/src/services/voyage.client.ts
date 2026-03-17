/**
 * Shared Voyage AI HTTP client.
 *
 * Consolidates the embedding API call logic used by both embedding.service.ts
 * (document embedding) and search.service.ts (query embedding). Single source
 * of truth for the API URL, model name, auth header, and response type.
 */

const VOYAGE_EMBEDDINGS_URL = "https://api.voyageai.com/v1/embeddings";
const EMBEDDING_MODEL = "voyage-4-lite";
const BATCH_SIZE = 128;

type FetchFn = typeof globalThis.fetch;

export interface EmbeddingResponse {
	data: Array<{ embedding: number[]; index: number }>;
}

export interface VoyageEmbedOptions {
	/** Texts to embed (max 128 per call — caller is responsible for batching). */
	input: string[];
	/** Voyage AI input_type: "document" for indexing, "query" for search. */
	inputType: "document" | "query";
	/** Override fetch for testing. */
	fetchFn?: FetchFn;
}

/**
 * Call the Voyage AI embeddings endpoint.
 *
 * Throws on HTTP errors. Returns the parsed EmbeddingResponse.
 * When VOYAGE_API_KEY is unset and no fetchFn override is provided, returns null
 * (dev-mode guard — caller should skip embedding).
 */
export async function callVoyageEmbeddings(
	options: VoyageEmbedOptions,
): Promise<EmbeddingResponse | null> {
	const apiKey = process.env.VOYAGE_API_KEY;
	const fetchFn = options.fetchFn ?? globalThis.fetch;

	if (!apiKey && !options.fetchFn) {
		return null;
	}

	const response = await fetchFn(VOYAGE_EMBEDDINGS_URL, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${apiKey ?? "test"}`,
		},
		body: JSON.stringify({
			model: EMBEDDING_MODEL,
			input: options.input,
			input_type: options.inputType,
		}),
	});

	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(
			`Voyage embeddings API error (${response.status}): ${errorText}`,
		);
	}

	return (await response.json()) as EmbeddingResponse;
}

export { BATCH_SIZE, EMBEDDING_MODEL, VOYAGE_EMBEDDINGS_URL };
export type { FetchFn };
