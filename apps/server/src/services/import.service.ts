import { eq } from "drizzle-orm";
import type { Database } from "../db/index.js";
import { sources } from "../db/schema/index.js";
import { NotFoundError } from "../lib/errors.js";
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

	async processSource(
		db: Database,
		storage: StorageProvider,
		sourceId: string,
	): Promise<void> {
		const rows = await db
			.select()
			.from(sources)
			.where(eq(sources.id, sourceId));
		if (rows.length === 0) throw new NotFoundError("Source", sourceId);
		const source = first(rows);

		await db
			.update(sources)
			.set({ status: "extracting" })
			.where(eq(sources.id, sourceId));

		try {
			const key = source.storageKey;
			if (!key) {
				throw new Error("Source has no storageKey");
			}
			const buffer = await storage.getFileBuffer(key);
			const mimeType = source.mimeType ?? "text/plain";
			const text = await extractText(mimeType, buffer);
			await db
				.update(sources)
				.set({
					status: "done",
					metadata: { ...source.metadata, extractedText: text },
				})
				.where(eq(sources.id, sourceId));
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			await db
				.update(sources)
				.set({
					status: "error",
					metadata: {
						...(source.metadata ?? {}),
						extractionError: message,
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
	 * Process all pending sources (e.g. from a cron or pnpm script).
	 * Calls processSource for each; safe to re-run.
	 */
	async processPendingSources(
		db: Database,
		storage: StorageProvider,
		limit = 50,
	): Promise<number> {
		const pending = await this.listPending(db, limit);
		for (const source of pending) {
			await this.processSource(db, storage, source.id);
		}
		return pending.length;
	},
};
