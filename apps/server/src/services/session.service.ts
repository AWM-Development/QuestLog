import type {
	SessionCreateInput,
	SessionFinalizeInput,
	SessionUpdateInput,
} from "@questlog/shared";
import { desc, eq, max } from "drizzle-orm";
import type { Database } from "../db/index.js";
import { campaigns, sessionEntities, sessions } from "../db/schema/index.js";
import { NotFoundError } from "../lib/errors.js";
import { first } from "../lib/utils.js";
import type { EntitySpan } from "./entity.service.js";

export const sessionService = {
	async create(db: Database, input: SessionCreateInput) {
		const [campaign] = await db
			.select({ id: campaigns.id })
			.from(campaigns)
			.where(eq(campaigns.id, input.campaignId))
			.limit(1);
		if (!campaign) {
			throw new NotFoundError("Campaign", input.campaignId);
		}

		const [agg] = await db
			.select({ maxNum: max(sessions.sessionNumber) })
			.from(sessions)
			.where(eq(sessions.campaignId, input.campaignId));

		const sessionNumber = (agg?.maxNum ?? 0) + 1;
		const content = input.content ?? "";

		const rows = await db
			.insert(sessions)
			.values({
				campaignId: input.campaignId,
				sessionNumber,
				title: input.title ?? null,
				content,
				status: "draft",
			})
			.returning();
		return first(rows);
	},

	async getById(db: Database, id: string) {
		const rows = await db.select().from(sessions).where(eq(sessions.id, id));
		if (rows.length === 0) {
			throw new NotFoundError("Session", id);
		}
		return first(rows);
	},

	async list(db: Database, campaignId: string) {
		return db
			.select()
			.from(sessions)
			.where(eq(sessions.campaignId, campaignId))
			.orderBy(desc(sessions.sessionNumber));
	},

	async update(db: Database, input: SessionUpdateInput) {
		const { id, ...fields } = input;
		const updateData: Record<string, unknown> = {};
		if ("title" in fields) updateData.title = fields.title;
		if ("content" in fields) updateData.content = fields.content;
		if ("summary" in fields) updateData.summary = fields.summary;
		if ("tags" in fields) updateData.tags = fields.tags;
		if ("sessionNumber" in fields)
			updateData.sessionNumber = fields.sessionNumber;
		if ("date" in fields) updateData.date = fields.date;
		if ("dismissedEntityTexts" in fields)
			updateData.dismissedEntityTexts = fields.dismissedEntityTexts;

		if (Object.keys(updateData).length === 0) {
			return this.getById(db, id);
		}

		const rows = await db
			.update(sessions)
			.set(updateData)
			.where(eq(sessions.id, id))
			.returning();

		if (rows.length === 0) {
			throw new NotFoundError("Session", id);
		}
		return first(rows);
	},

	async finalize(db: Database, input: SessionFinalizeInput) {
		const { id, title, summary, tags, sessionNumber, date } = input;
		const updateData: Record<string, unknown> = {
			status: "finalized",
		};
		if (title !== undefined) updateData.title = title;
		if (summary !== undefined) updateData.summary = summary;
		if (tags !== undefined) updateData.tags = tags;
		if (sessionNumber !== undefined) updateData.sessionNumber = sessionNumber;
		if (date !== undefined) updateData.date = date;

		const rows = await db
			.update(sessions)
			.set(updateData)
			.where(eq(sessions.id, id))
			.returning();

		if (rows.length === 0) {
			throw new NotFoundError("Session", id);
		}
		return first(rows);
	},

	async linkEntities(db: Database, sessionId: string, spans: EntitySpan[]) {
		if (spans.length === 0) return [];

		return db
			.insert(sessionEntities)
			.values(
				spans.map((span) => ({
					sessionId,
					entityId: span.entityId,
					matchType: span.matchType,
				})),
			)
			.returning();
	},
};
