import { eq } from "drizzle-orm";
import type { Database } from "../db/index.js";
import { sources } from "../db/schema/index.js";
import { NotFoundError } from "../lib/errors.js";
import { chunkText } from "./chunking.service.js";
import { type EmbedOptions, embedChunks } from "./embedding.service.js";
import { extractText } from "./extraction.service.js";
import type { StorageProvider } from "./storage.service.js";

function first<T>(rows: T[]): T {
	return rows[0] as T;
}

export interface CreateFileSourceInput {
	campaignId: string;
	filename: string;
	mimeType: string;
	sizeBytes: number;
	content: Buffer;
}

export interface ProcessOptions {
	/** Override for embedding fetch (testing). */
	embedOptions?: EmbedOptions;
}

/**
 * Detect whether extracted PDF text is effectively empty (scanned PDF).
 * Strips page separator markers and whitespace.
 */
function isScannedPdf(text: string): boolean {
	const stripped = text.replace(/--\s*\d+\s+of\s+\d+\s*--/g, "").trim();
	return stripped.length === 0;
}

export const importService = {
	async createFileSource(
		db: Database,
		storage: StorageProvider,
		input: CreateFileSourceInput,
	) {
		const rows = await db
			.insert(sources)
			.values({
				campaignId: input.campaignId,
				name: input.filename,
				type: "file",
				mimeType: input.mimeType,
				sizeBytes: input.sizeBytes,
				status: "pending",
			})
			.returning();
		const source = first(rows);
		const storageKey = `${source.campaignId}/${source.id}/${input.filename}`;
		await storage.saveFile({ storageKey, content: input.content });
		await db
			.update(sources)
			.set({ storageKey })
			.where(eq(sources.id, source.id));
		const updated = await db
			.select()
			.from(sources)
			.where(eq(sources.id, source.id));
		return first(updated);
	},

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
		const rows = await db
			.select()
			.from(sources)
			.where(eq(sources.id, sourceId));
		if (rows.length === 0) throw new NotFoundError("Source", sourceId);
		const source = first(rows);

		try {
			// --- Stage 1: Extraction ---
			await db
				.update(sources)
				.set({ status: "extracting" })
				.where(eq(sources.id, sourceId));

			let text: string;

			// Handle pasted text sources (no file to extract)
			if (source.type === "paste") {
				const content = source.metadata?.content;
				if (typeof content !== "string" || !content.trim()) {
					throw new Error("Paste source has no content");
				}
				text = content;
			} else {
				const key = source.storageKey;
				if (!key) {
					throw new Error("Source has no storageKey");
				}
				const buffer = await storage.getFileBuffer(key);
				const mimeType = source.mimeType ?? "text/plain";
				text = await extractText(mimeType, buffer);

				// Check for scanned PDFs (empty extracted text)
				if (mimeType === "application/pdf" && isScannedPdf(text)) {
					await db
						.update(sources)
						.set({
							status: "error",
							metadata: {
								...(source.metadata ?? {}),
								errorReason: "scanned_pdf",
							},
						})
						.where(eq(sources.id, sourceId));
					return;
				}
			}

			await db
				.update(sources)
				.set({
					metadata: { ...(source.metadata ?? {}), extractedText: text },
				})
				.where(eq(sources.id, sourceId));

			// --- Stage 2: Chunking ---
			await db
				.update(sources)
				.set({ status: "chunking" })
				.where(eq(sources.id, sourceId));

			const textChunks = chunkText(text, {
				sourceId,
				campaignId: source.campaignId,
			});

			// --- Stage 3: Embedding ---
			await db
				.update(sources)
				.set({ status: "embedding" })
				.where(eq(sources.id, sourceId));

			await embedChunks(db, textChunks, options?.embedOptions);

			// --- Done ---
			await db
				.update(sources)
				.set({ status: "done" })
				.where(eq(sources.id, sourceId));
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			await db
				.update(sources)
				.set({
					status: "error",
					metadata: {
						...(source.metadata ?? {}),
						errorReason: message,
					},
				})
				.where(eq(sources.id, sourceId));
		}
	},

	async getById(db: Database, sourceId: string) {
		const rows = await db
			.select()
			.from(sources)
			.where(eq(sources.id, sourceId));
		if (rows.length === 0) throw new NotFoundError("Source", sourceId);
		return first(rows);
	},

	async listByCampaign(db: Database, campaignId: string) {
		return db.select().from(sources).where(eq(sources.campaignId, campaignId));
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
