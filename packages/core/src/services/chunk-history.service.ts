import { and, asc, eq, sql } from "drizzle-orm";
import type { Database, Transaction } from "../db/index.js";
import { chunkCorrections } from "../db/schema/index.js";

export interface RecordChunkCorrectionInput {
	campaignId: string;
	correctionText: string;
	supersededChunkIds: string[];
	createdChunkIds: string[];
}

export const chunkHistoryService = {
	/**
	 * Persist one correction event — called from confirm_correct_lore's
	 * existing transaction, immediately after the `chunks` status update, so
	 * the correction event and the status flip commit atomically together.
	 */
	async record(tx: Transaction, input: RecordChunkCorrectionInput) {
		await tx.insert(chunkCorrections).values({
			campaignId: input.campaignId,
			correctionText: input.correctionText,
			supersededChunkIds: input.supersededChunkIds,
			createdChunkIds: input.createdChunkIds,
		});
	},

	/**
	 * Campaign-scoped lookup of every correction event that superseded
	 * `chunkId` (T-068: `chunkId` arrives as an untrusted external id from
	 * the calling model). A given chunk appears in at most one correction
	 * event — `correct_lore`'s `sourceId` path only ever targets a source's
	 * non-superseded chunks, so a chunk can't be re-targeted once superseded.
	 */
	async listForChunk(db: Database, campaignId: string, chunkId: string) {
		return db
			.select()
			.from(chunkCorrections)
			.where(
				and(
					eq(chunkCorrections.campaignId, campaignId),
					sql`${chunkCorrections.supersededChunkIds} @> ${JSON.stringify([chunkId])}::jsonb`,
				),
			)
			.orderBy(asc(chunkCorrections.createdAt));
	},
};
