import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createTestDb } from "@questlog/core/db/test-helpers.js";
import {
	findProperNounSpans,
	guessEntityType,
} from "@questlog/core/services/entity-candidate-detection.service.js";
import {
	CANDIDATE_EXTRACTION_TEXT_MARKER,
	extractExcerpt,
} from "@questlog/core/services/entity.service.js";
import type { LlmService } from "@questlog/core/services/llm.service.js";
import { sourceService } from "@questlog/core/services/source.service.js";
import { createMemoryStorage } from "@questlog/core/services/storage.service.js";
import type { FetchFn } from "@questlog/core/services/voyage.client.js";
import { afterAll, vi } from "vitest";
import { createMcpServer } from "./server.js";

/**
 * Shared test infrastructure extracted from `server.test.ts` by T-103. One
 * `createTestDb()` call per test *file* that imports `db` from here —
 * matches `server.test.ts`'s original single-file behavior (one connection
 * per file), just multiplied across the files this split produced. See
 * Docs/IMPLEMENTATION_NOTES.md § T-103.
 */
export const { db, close } = createTestDb();

afterAll(async () => {
	await close();
});

export function createMockFetch(embedding: number[]): FetchFn {
	return vi.fn().mockImplementation(async () => ({
		ok: true,
		json: async () => ({ data: [{ embedding, index: 0 }] }),
	})) as unknown as FetchFn;
}

export function createFailingFetch(): FetchFn {
	return vi.fn().mockImplementation(async () => ({
		ok: false,
		status: 500,
		text: async () => "Voyage API error",
	})) as unknown as FetchFn;
}

/**
 * Default test double for the structured-extraction client (T-119): reuses
 * T-078's original heuristic (`findProperNounSpans`/`guessEntityType`, kept
 * in place but unused by production `detectCandidates` per this ticket's
 * scope) to synthesize a plausible LLM response from the prompt's embedded
 * text — every pre-T-119 fixture in this file keeps behaving exactly as
 * before without per-test mocking. Recovers the raw text via
 * `CANDIDATE_EXTRACTION_TEXT_MARKER`'s marker string (see
 * entity.service.ts) rather than re-parsing arbitrary prompt structure.
 */
export function createFixtureLlmService(): Pick<
	LlmService,
	"callClaudeStructured"
> {
	return {
		callClaudeStructured: vi
			.fn()
			.mockImplementation(async <T>({ prompt }: { prompt: string }) => {
				const markerIndex = prompt.indexOf(CANDIDATE_EXTRACTION_TEXT_MARKER);
				const text =
					markerIndex >= 0
						? prompt.slice(
								markerIndex + CANDIDATE_EXTRACTION_TEXT_MARKER.length,
							)
						: "";
				const candidates = findProperNounSpans(text).map((span) => ({
					name: span.name,
					entityType: guessEntityType(text, {
						startIndex: span.start,
						endIndex: span.end,
						name: span.name,
					}),
					description: extractExcerpt(text, {
						startIndex: span.start,
						endIndex: span.end,
					}),
					startIndex: span.start,
					endIndex: span.end,
				}));
				return {
					data: { candidates } as T,
					usage: { inputTokens: 0, outputTokens: 0 },
				};
			}),
	};
}

export async function connectedClient(
	fetchFn: FetchFn,
	llmService: Pick<
		LlmService,
		"callClaudeStructured"
	> = createFixtureLlmService(),
) {
	const server = createMcpServer({
		db,
		fetchFn,
		storage: createMemoryStorage(),
		llmService,
	});
	const client = new Client({ name: "test-client", version: "0.0.0" });
	const [clientTransport, serverTransport] =
		InMemoryTransport.createLinkedPair();
	await Promise.all([
		client.connect(clientTransport),
		server.connect(serverTransport),
	]);
	return client;
}

/** Mirrors `apps/server/src/search.e2e.test.ts`'s waitForStatus — polls until a source's fire-and-forget processing settles. */
export async function waitForStatus(
	sourceId: string,
	target: string,
	timeoutMs = 5_000,
): Promise<string> {
	const start = Date.now();
	let lastStatus = "";
	while (Date.now() - start < timeoutMs) {
		const source = await sourceService.getByIdUnscoped(db, sourceId);
		lastStatus = source.status;
		if (lastStatus === target || lastStatus === "error") return lastStatus;
		await new Promise((resolve) => setTimeout(resolve, 20));
	}
	return lastStatus;
}
