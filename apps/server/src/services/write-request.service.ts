import { eq } from "drizzle-orm";
import type { Database } from "../db/index.js";
import { writeRequests } from "../db/schema/index.js";
import { NotFoundError } from "../lib/errors.js";
import { first } from "../lib/utils.js";

const DEFAULT_TTL_MS = 15 * 60 * 1000;

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

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
		const row = await findPendingRow(db, token);

		return db.transaction(async (tx) => {
			const appliedResult = await applyFn(tx, row.payload);
			await tx
				.update(writeRequests)
				.set({ appliedResult, confirmedAt: new Date() })
				.where(eq(writeRequests.id, token));
			return appliedResult;
		});
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
