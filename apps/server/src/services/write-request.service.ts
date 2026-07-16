import { and, eq, gt, isNull } from "drizzle-orm";
import type { Database, Transaction } from "../db/index.js";
import { writeRequests } from "../db/schema/index.js";
import { NotFoundError } from "../lib/errors.js";
import { first } from "../lib/utils.js";

const DEFAULT_TTL_MS = 15 * 60 * 1000;

export const writeRequestService = {
	async createPreview(
		db: Database,
		input: {
			campaignId: string;
			toolName: string;
			payload: unknown;
			ttlMs?: number;
		},
	) {
		const ttlMs = input.ttlMs ?? DEFAULT_TTL_MS;
		const rows = await db
			.insert(writeRequests)
			.values({
				campaignId: input.campaignId,
				toolName: input.toolName,
				payload: input.payload,
				expiresAt: new Date(Date.now() + ttlMs),
			})
			.returning();
		const row = first(rows);
		return { token: row.id, payload: row.payload, expiresAt: row.expiresAt };
	},

	async getPending(db: Database, token: string) {
		const row = await findPendingRow(db, token);
		return row.payload;
	},

	async confirm(
		db: Database,
		token: string,
		applyFn: (db: Transaction, payload: unknown) => Promise<unknown>,
	) {
		// Atomic conditional claim, not a row lock: only one of two concurrent
		// confirm() calls for the same token can flip claimedAt from null, so
		// the loser sees zero rows returned and 404s here, before applyFn runs
		// and without holding a lock across it.
		const claimedRows = await db
			.update(writeRequests)
			.set({ claimedAt: new Date() })
			.where(
				and(
					eq(writeRequests.id, token),
					isNull(writeRequests.claimedAt),
					isNull(writeRequests.confirmedAt),
					gt(writeRequests.expiresAt, new Date()),
				),
			)
			.returning();
		const row = claimedRows[0];
		if (!row) {
			throw new NotFoundError("WriteRequest", token);
		}

		try {
			return await db.transaction(async (tx) => {
				const appliedResult = await applyFn(tx, row.payload);
				await tx
					.update(writeRequests)
					.set({ appliedResult, confirmedAt: new Date() })
					.where(eq(writeRequests.id, token));
				return appliedResult;
			});
		} catch (err) {
			// Clear the claim (not confirmedAt, which was never set) so the same
			// token can be reclaimed on retry.
			await db
				.update(writeRequests)
				.set({ claimedAt: null })
				.where(eq(writeRequests.id, token));
			throw err;
		}
	},
};

async function findPendingRow(db: Database, token: string) {
	const rows = await db
		.select()
		.from(writeRequests)
		.where(eq(writeRequests.id, token));
	const row = rows[0];
	if (
		!row ||
		row.confirmedAt !== null ||
		row.expiresAt.getTime() < Date.now()
	) {
		throw new NotFoundError("WriteRequest", token);
	}
	return row;
}
