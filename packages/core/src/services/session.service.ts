import type {
	SessionCreateInput,
	SessionFinalizeInput,
	SessionUpdateInput,
} from "@questlog/shared";
import { and, desc, eq, max } from "drizzle-orm";
import type { Database, Transaction } from "../db/index.js";
import { campaigns, sessionEntities, sessions } from "../db/schema/index.js";
import { NotFoundError } from "../lib/errors.js";
import { first } from "../lib/utils.js";
import type { EntitySpan } from "./entity.service.js";

export const sessionService = {
	async create(db: Database | Transaction, input: SessionCreateInput) {
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

	/**
	 * Get a single session by ID with no campaign scope — trusted-internal
	 * callers only. MCP tool handlers must use {@link getByIdForCampaign}
	 * instead (T-068; `.claude/rules/mcp.md`).
	 */
	async getByIdUnscoped(db: Database, id: string) {
		const rows = await db.select().from(sessions).where(eq(sessions.id, id));
		if (rows.length === 0) {
			throw new NotFoundError("Session", id);
		}
		return first(rows);
	},

	/**
	 * Get a single session by ID scoped to a campaign, throwing NotFoundError
	 * if absent or owned by a different campaign — same shape as
	 * sourceService.getByIdForCampaign, for callers taking untrusted external
	 * input (e.g. an MCP tool) rather than an internally-sourced id.
	 */
	async getByIdForCampaign(db: Database, campaignId: string, id: string) {
		const rows = await db
			.select()
			.from(sessions)
			.where(and(eq(sessions.id, id), eq(sessions.campaignId, campaignId)));
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
			return this.getByIdUnscoped(db, id);
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

	async finalize(db: Database | Transaction, input: SessionFinalizeInput) {
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

	async linkEntities(
		db: Database | Transaction,
		sessionId: string,
		spans: EntitySpan[],
	) {
		if (spans.length === 0) return [];

		// A session can mention the same entity in more than one span (e.g. an
		// NPC named twice); the link table tracks "mentioned in this session",
		// not individual mentions, so dedupe by entityId before inserting.
		const uniqueByEntity = new Map(spans.map((span) => [span.entityId, span]));

		return db
			.insert(sessionEntities)
			.values(
				Array.from(uniqueByEntity.values()).map((span) => ({
					sessionId,
					entityId: span.entityId,
					matchType: span.matchType,
				})),
			)
			.returning();
	},
};
