import { and, eq } from "drizzle-orm";
import type { Database } from "../db/index.js";
import {
	campaignWealth,
	entities,
	inventoryItems,
} from "../db/schema/index.js";
import { NotFoundError, ValidationError } from "../lib/errors.js";
import { first } from "../lib/utils.js";

const DEFAULT_DENOMINATION = "wealth";

/** Throws NotFoundError unless `ownerEntityId` names an existing entity in `campaignId` — shared by addItem/transferItem so an item can never point at a nonexistent or cross-campaign owner. */
async function assertOwnerExists(
	db: Database,
	campaignId: string,
	ownerEntityId: string,
) {
	const rows = await db
		.select({ id: entities.id })
		.from(entities)
		.where(
			and(eq(entities.id, ownerEntityId), eq(entities.campaignId, campaignId)),
		);
	if (rows.length === 0) throw new NotFoundError("Entity", ownerEntityId);
}

export const inventoryService = {
	async addItem(
		db: Database,
		input: {
			campaignId: string;
			name: string;
			description?: string;
			quantity?: number;
			value?: number;
			ownerEntityId?: string;
		},
	) {
		if (input.ownerEntityId) {
			await assertOwnerExists(db, input.campaignId, input.ownerEntityId);
		}
		const rows = await db
			.insert(inventoryItems)
			.values({
				campaignId: input.campaignId,
				name: input.name,
				description: input.description ?? null,
				quantity: input.quantity ?? 1,
				value: input.value ?? null,
				ownerEntityId: input.ownerEntityId ?? null,
			})
			.returning();
		return first(rows);
	},

	async transferItem(
		db: Database,
		input: { itemId: string; ownerEntityId: string | null },
	) {
		const existingRows = await db
			.select()
			.from(inventoryItems)
			.where(eq(inventoryItems.id, input.itemId));
		const existing = existingRows[0];
		if (!existing) throw new NotFoundError("InventoryItem", input.itemId);

		if (input.ownerEntityId) {
			await assertOwnerExists(db, existing.campaignId, input.ownerEntityId);
		}

		const rows = await db
			.update(inventoryItems)
			.set({ ownerEntityId: input.ownerEntityId })
			.where(eq(inventoryItems.id, input.itemId))
			.returning();
		return first(rows);
	},

	/**
	 * Upserts `(campaignId, denomination)`'s wealth row, applying `delta` to
	 * its current amount (0 if the row doesn't exist yet — `denomination` is
	 * just a column, so a first-ever adjustment for a new denomination is
	 * indistinguishable from any other upsert, T-142/G-023). Runs inside a
	 * transaction so the read-then-write can't race a concurrent adjustment
	 * into a stale below-zero check.
	 */
	async adjustWealth(
		db: Database,
		input: { campaignId: string; delta: number; denomination?: string },
	) {
		const denomination = input.denomination ?? DEFAULT_DENOMINATION;
		return db.transaction(async (tx) => {
			const existingRows = await tx
				.select()
				.from(campaignWealth)
				.where(
					and(
						eq(campaignWealth.campaignId, input.campaignId),
						eq(campaignWealth.denomination, denomination),
					),
				);
			const existing = existingRows[0];
			const newAmount = (existing?.amount ?? 0) + input.delta;
			if (newAmount < 0) {
				throw new ValidationError(
					`Adjustment would take ${denomination} below 0 (current ${existing?.amount ?? 0}, delta ${input.delta})`,
				);
			}

			if (existing) {
				const rows = await tx
					.update(campaignWealth)
					.set({ amount: newAmount })
					.where(eq(campaignWealth.id, existing.id))
					.returning();
				return first(rows);
			}

			const rows = await tx
				.insert(campaignWealth)
				.values({
					campaignId: input.campaignId,
					denomination,
					amount: newAmount,
				})
				.returning();
			return first(rows);
		});
	},

	async listInventory(
		db: Database,
		input: { campaignId: string; ownerEntityId?: string },
	) {
		const items = await db
			.select()
			.from(inventoryItems)
			.where(
				and(
					eq(inventoryItems.campaignId, input.campaignId),
					input.ownerEntityId !== undefined
						? eq(inventoryItems.ownerEntityId, input.ownerEntityId)
						: undefined,
				),
			);
		const wealth = await db
			.select()
			.from(campaignWealth)
			.where(eq(campaignWealth.campaignId, input.campaignId));

		return { items, wealth };
	},
};
