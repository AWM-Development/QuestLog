import { and, asc, eq, inArray, sql } from "drizzle-orm";
import type { Database } from "../db/index.js";
import {
	campaigns,
	encounterMembers,
	encounters,
	entities,
} from "../db/schema/index.js";
import { NotFoundError } from "../lib/errors.js";
import { first } from "../lib/utils.js";

interface SaveEncounterInput {
	campaignId: string;
	name: string;
	notes?: string;
	members: { entityId: string; count: number }[];
}

export const encounterService = {
	/** Additive-only: never mutates an existing encounter. Campaign and member entities are validated with campaign-filtered queries (no *Unscoped call). */
	async save(db: Database, input: SaveEncounterInput) {
		return db.transaction(async (tx) => {
			const campaignRows = await tx
				.select({ id: campaigns.id })
				.from(campaigns)
				.where(eq(campaigns.id, input.campaignId));
			if (campaignRows.length === 0) {
				throw new NotFoundError("Campaign", input.campaignId);
			}

			const entityIds = [...new Set(input.members.map((m) => m.entityId))];
			if (entityIds.length > 0) {
				const found = await tx
					.select({ id: entities.id })
					.from(entities)
					.where(
						and(
							inArray(entities.id, entityIds),
							eq(entities.campaignId, input.campaignId),
						),
					);
				const foundIds = new Set(found.map((r) => r.id));
				const missing = entityIds.find((id) => !foundIds.has(id));
				if (missing) throw new NotFoundError("Entity", missing);
			}

			const encounterRows = await tx
				.insert(encounters)
				.values({
					campaignId: input.campaignId,
					name: input.name,
					notes: input.notes ?? null,
				})
				.returning();
			const encounter = first(encounterRows);

			if (input.members.length > 0) {
				await tx.insert(encounterMembers).values(
					input.members.map((member) => ({
						encounterId: encounter.id,
						entityId: member.entityId,
						count: member.count,
					})),
				);
			}

			return encounter;
		});
	},

	/** Every encounter in the campaign, name + member-count summary (not full member detail) — matches entityService.list's shape. */
	async list(db: Database, campaignId: string) {
		const rows = await db
			.select({
				id: encounters.id,
				campaignId: encounters.campaignId,
				name: encounters.name,
				notes: encounters.notes,
				createdAt: encounters.createdAt,
				updatedAt: encounters.updatedAt,
				memberCount: sql<number>`count(${encounterMembers.id})`.mapWith(Number),
			})
			.from(encounters)
			.leftJoin(
				encounterMembers,
				eq(encounterMembers.encounterId, encounters.id),
			)
			.where(eq(encounters.campaignId, campaignId))
			.groupBy(encounters.id)
			.orderBy(asc(encounters.createdAt), asc(encounters.id));

		return rows;
	},

	/** The encounter plus its members, each resolved to `{ entityId, name, type, count }` — a joined read, same shape get_entity already attaches items. */
	async getById(db: Database, campaignId: string, encounterId: string) {
		const encounterRows = await db
			.select()
			.from(encounters)
			.where(
				and(
					eq(encounters.id, encounterId),
					eq(encounters.campaignId, campaignId),
				),
			);
		const encounter = encounterRows[0];
		if (!encounter) throw new NotFoundError("Encounter", encounterId);

		const memberRows = await db
			.select({
				entityId: entities.id,
				name: entities.name,
				type: entities.type,
				count: encounterMembers.count,
			})
			.from(encounterMembers)
			.innerJoin(entities, eq(entities.id, encounterMembers.entityId))
			.where(eq(encounterMembers.encounterId, encounterId))
			.orderBy(asc(encounterMembers.createdAt), asc(encounterMembers.id));

		return { ...encounter, members: memberRows };
	},
};
