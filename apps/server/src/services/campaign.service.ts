import type { CampaignCreateInput } from "@questlog/shared";
import { desc, eq } from "drizzle-orm";
import type { Database } from "../db/index.js";
import { campaigns } from "../db/schema/index.js";
import { NotFoundError } from "../lib/errors.js";

function first<T>(rows: T[]): T {
	return rows[0] as T;
}

export const campaignService = {
	async create(db: Database, input: CampaignCreateInput) {
		const rows = await db
			.insert(campaigns)
			.values({
				name: input.name,
				theme: input.theme,
				description: input.description ?? null,
				gameSystem: input.gameSystem ?? null,
			})
			.returning();
		return first(rows);
	},

	async getById(db: Database, id: string) {
		const rows = await db.select().from(campaigns).where(eq(campaigns.id, id));
		if (rows.length === 0) {
			throw new NotFoundError("Campaign", id);
		}
		return first(rows);
	},

	async list(db: Database) {
		return db
			.select()
			.from(campaigns)
			.where(eq(campaigns.status, "active"))
			.orderBy(desc(campaigns.updatedAt));
	},

	async update(db: Database, input: { id: string; [key: string]: unknown }) {
		const { id, ...fields } = input;

		// Build update payload, only including fields that were provided
		const updateData: Record<string, unknown> = {};
		if ("name" in fields) updateData.name = fields.name;
		if ("description" in fields) updateData.description = fields.description;
		if ("theme" in fields) updateData.theme = fields.theme;
		if ("gameSystem" in fields) updateData.gameSystem = fields.gameSystem;
		if ("status" in fields) updateData.status = fields.status;

		if (Object.keys(updateData).length === 0) {
			return this.getById(db, id);
		}

		const rows = await db
			.update(campaigns)
			.set(updateData)
			.where(eq(campaigns.id, id))
			.returning();

		if (rows.length === 0) {
			throw new NotFoundError("Campaign", id);
		}
		return first(rows);
	},

	async archive(db: Database, id: string) {
		const rows = await db
			.update(campaigns)
			.set({ status: "archived" })
			.where(eq(campaigns.id, id))
			.returning();

		if (rows.length === 0) {
			throw new NotFoundError("Campaign", id);
		}
		return first(rows);
	},
};
