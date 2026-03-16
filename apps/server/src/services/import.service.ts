/**
 * Import processing pipeline.
 * Orchestrates: extraction → chunking → embedding → done.
 * Source CRUD lives in source.service.ts — this module owns only pipeline logic.
 */

import { eq } from "drizzle-orm";
import type { Database } from "../db/index.js";
import { sources } from "../db/schema/index.js";
import { chunkText } from "./chunking.service.js";
import { type EmbedOptions, embedChunks } from "./embedding.service.js";
import { extractText } from "./extraction.service.js";
import { sourceService } from "./source.service.js";
import type { StorageProvider } from "./storage.service.js";

export interface ProcessOptions {
	/** Override for embedding fetch (testing). */
	embedOptions?: EmbedOptions;
}

/**
 * Detect whether extracted PDF text is effectively empty (scanned PDF).
 * Strips pdf-parse page separator markers and whitespace.
 */
function isScannedPdf(text: string): boolean {
	const stripped = text.replace(/--\s*\d+\s+of\s+\d+\s*--/g, "").trim();
	return stripped.length === 0;
}

/** Read the text content from a source, either from storage (file) or metadata (paste). */
async function getSourceText(
	source: {
		type: string;
		storageKey: string | null;
		mimeType: string | null;
		metadata: Record<string, unknown> | null;
	},
	storage: StorageProvider,
): Promise<string> {
	if (source.type === "paste") {
		const content = source.metadata?.content;
		if (typeof content !== "string" || !content.trim()) {
			throw new Error("Paste source has no content");
		}
		return content;
	}

	const key = source.storageKey;
	if (!key) throw new Error("Source has no storageKey");

	const buffer = await storage.getFileBuffer(key);
	const mimeType = source.mimeType ?? "text/plain";
	return extractText(mimeType, buffer);
}

export const importService = {
	/**
	 * Full processing pipeline for a source:
	 * pending → extracting → chunking → embedding → done | error
	 */
	async processSource(
		db: Database,
		storage: StorageProvider,
		sourceId: string,
		options?: ProcessOptions,
	): Promise<void> {
		const source = await sourceService.getById(db, sourceId);

		try {
			// --- Extract ---
			await sourceService.updateStatus(db, sourceId, "extracting");
			const text = await getSourceText(source, storage);

			// Scanned PDF detection
			if (source.mimeType === "application/pdf" && isScannedPdf(text)) {
				await sourceService.updateStatus(db, sourceId, "error", {
					errorReason: "scanned_pdf",
				});
				return;
			}

			await sourceService.updateStatus(db, sourceId, "chunking", {
				extractedText: text,
			});

			// --- Chunk ---
			const textChunks = chunkText(text, {
				sourceId,
				campaignId: source.campaignId,
			});

			// --- Embed ---
			await sourceService.updateStatus(db, sourceId, "embedding");
			await embedChunks(db, textChunks, options?.embedOptions);

			// --- Done ---
			await sourceService.updateStatus(db, sourceId, "done");
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			await sourceService.updateStatus(db, sourceId, "error", {
				errorReason: message,
			});
		}
	},

	async listPending(db: Database, limit = 10) {
		return db
			.select()
			.from(sources)
			.where(eq(sources.status, "pending"))
			.limit(limit);
	},

	/**
	 * Process all pending sources (e.g. from a cron or on-start hook).
	 * Calls processSource for each; safe to re-run.
	 */
	async processPendingSources(
		db: Database,
		storage: StorageProvider,
		limit = 50,
		options?: ProcessOptions,
	): Promise<number> {
		const pending = await this.listPending(db, limit);
		for (const source of pending) {
			await this.processSource(db, storage, source.id, options);
		}
		return pending.length;
	},
};
