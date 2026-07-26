import type { SourceStatus } from "@questlog/shared";
import { and, desc, eq } from "drizzle-orm";
import type { Database } from "../db/index.js";
import { chunks, sources } from "../db/schema/index.js";
import { NotFoundError } from "../lib/errors.js";
import { first } from "../lib/utils.js";

export interface CreateSourceInput {
	campaignId: string;
	name: string;
	type: string;
	mimeType?: string | null;
	sizeBytes: number | null;
	hash: string | null;
}

export const sourceService = {
	/**
	 * Create a source record when a file is uploaded.
	 * The upload route populates hash from the file content (SHA-256).
	 */
	async create(db: Database, input: CreateSourceInput) {
		const rows = await db
			.insert(sources)
			.values({
				campaignId: input.campaignId,
				name: input.name,
				type: input.type,
				mimeType: input.mimeType ?? null,
				sizeBytes: input.sizeBytes ?? null,
				hash: input.hash ?? null,
				status: "pending",
			})
			.returning();
		return first(rows);
	},

	/**
	 * Create a source record for pasted text.
	 * Content is stored in metadata.content for Task 2.2 to process.
	 */
	async createFromText(
		db: Database,
		input: { campaignId: string; name: string; content: string },
	) {
		const rows = await db
			.insert(sources)
			.values({
				campaignId: input.campaignId,
				name: input.name,
				type: "paste",
				status: "pending",
				metadata: { content: input.content },
			})
			.returning();
		return first(rows);
	},

	/** List all sources for a campaign, ordered by createdAt desc. */
	async listByCampaign(db: Database, campaignId: string) {
		return db
			.select()
			.from(sources)
			.where(eq(sources.campaignId, campaignId))
			.orderBy(desc(sources.createdAt));
	},

	/** Get a single source by ID, throwing NotFoundError if absent. */
	async getById(db: Database, id: string) {
		const rows = await db.select().from(sources).where(eq(sources.id, id));
		if (rows.length === 0) {
			throw new NotFoundError("Source", id);
		}
		return first(rows);
	},

	/**
	 * Get a single source by ID scoped to a campaign, throwing NotFoundError
	 * if absent or owned by a different campaign — same shape as
	 * entityService.getById, for callers taking untrusted external input
	 * (e.g. an MCP tool) rather than an internally-sourced id.
	 */
	async getByIdForCampaign(db: Database, campaignId: string, id: string) {
		const rows = await db
			.select()
			.from(sources)
			.where(and(eq(sources.id, id), eq(sources.campaignId, campaignId)));
		if (rows.length === 0) {
			throw new NotFoundError("Source", id);
		}
		return first(rows);
	},

	/** Update source status, optionally merging metadata. */
	async updateStatus(
		db: Database,
		id: string,
		status: SourceStatus,
		metadata?: Record<string, unknown>,
	) {
		const set: Record<string, unknown> = { status };
		if (metadata) {
			const existing = await this.getById(db, id);
			set.metadata = { ...(existing.metadata ?? {}), ...metadata };
		}
		const rows = await db
			.update(sources)
			.set(set)
			.where(eq(sources.id, id))
			.returning();
		if (rows.length === 0) {
			throw new NotFoundError("Source", id);
		}
		return first(rows);
	},

	/** Set the storage key after file upload. */
	async setStorageKey(db: Database, id: string, storageKey: string) {
		await db.update(sources).set({ storageKey }).where(eq(sources.id, id));
	},

	/**
	 * Check for a duplicate: same campaignId + hash.
	 * Returns null if no duplicate found.
	 */
	async findDuplicate(db: Database, campaignId: string, hash: string) {
		const rows = await db
			.select()
			.from(sources)
			.where(and(eq(sources.campaignId, campaignId), eq(sources.hash, hash)));
		return rows.length > 0 ? first(rows) : null;
	},

	/**
	 * Delete a source and its associated chunks.
	 * Idempotent — does not throw if source does not exist.
	 */
	async delete(db: Database, id: string) {
		// Remove associated chunks first (FK constraint)
		await db.delete(chunks).where(eq(chunks.sourceId, id));
		await db.delete(sources).where(eq(sources.id, id));
	},

	/**
	 * Replace an existing source with a new one of the same name.
	 * Deletes the old record and creates the new one atomically.
	 */
	async replace(db: Database, oldId: string, newInput: CreateSourceInput) {
		await this.delete(db, oldId);
		return this.create(db, newInput);
	},
};
