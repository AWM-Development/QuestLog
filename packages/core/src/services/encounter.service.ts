import { and, eq, sql } from "drizzle-orm";
import type { Database } from "../db/index.js";
import { encounterMembers, encounters, entities } from "../db/schema/index.js";
import { NotFoundError } from "../lib/errors.js";
import { first } from "../lib/utils.js";

interface SaveEncounterInput {
	campaignId: string;
	name: string;
	notes?: string;
	members: { entityId: string; count: number }[];
}

export const encounterService = {
	/**
	 * Validates every member's entityId exists in campaignId (reuse
	 * entityService's scoped-lookup pattern via a direct campaign-filtered
	 * query — no *Unscoped call), then inserts the encounter and its members
	 * inside one transaction. Additive-only — never mutates an existing
	 * encounter (`.claude/rules/mcp.md`'s write-tool rule).
	 */
	async save(db: Database, input: SaveEncounterInput) {
		return db.transaction(async (tx) => {
			for (const member of input.members) {
				const rows = await tx
					.select({ id: entities.id })
					.from(entities)
					.where(
						and(
							eq(entities.id, member.entityId),
							eq(entities.campaignId, input.campaignId),
						),
					);
				if (rows.length === 0) {
					throw new NotFoundError("Entity", member.entityId);
				}
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
				memberCount: sql<number>`count(${encounterMembers.id})`.mapWith(
					Number,
				),
			})
			.from(encounters)
			.leftJoin(
				encounterMembers,
				eq(encounterMembers.encounterId, encounters.id),
			)
			.where(eq(encounters.campaignId, campaignId))
			.groupBy(encounters.id);

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
			.where(eq(encounterMembers.encounterId, encounterId));

		return { ...encounter, members: memberRows };
	},
};
