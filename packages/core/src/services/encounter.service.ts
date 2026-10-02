import { and, asc, eq, inArray, sql } from "drizzle-orm";
import type { Database, Transaction } from "../db/index.js";
import {
	campaigns,
	encounterMembers,
	encounters,
	entities,
} from "../db/schema/index.js";
import { NotFoundError } from "../lib/errors.js";
import { first } from "../lib/utils.js";
import {
	type ExtractedEncounterCreature,
	entityService,
} from "./entity.service.js";

interface SaveEncounterInput {
	campaignId: string;
	name: string;
	notes?: string;
	members: { entityId: string; count: number }[];
}

export interface MatchedEncounterMember {
	entityId: string;
	name: string;
	type: string;
	count: number;
}

export interface NewMonsterCandidate {
	name: string;
	count: number;
}

export interface GeneratedEncounterPlan {
	matched: MatchedEncounterMember[];
	newMonsterCandidates: NewMonsterCandidate[];
}

export const encounterService = {
	/**
	 * Splits extracted creatures into roster monsters (fuzzy-matched by name, type "monster" only) and names with no roster match. Creatures resolving to the same entity / same name (case-insensitive) are merged and their counts summed. Read-only.
	 */
	async planFromCreatures(
		db: Database,
		campaignId: string,
		creatures: ExtractedEncounterCreature[],
	): Promise<GeneratedEncounterPlan> {
		const matched = new Map<string, MatchedEncounterMember>();
		const unmatched = new Map<string, NewMonsterCandidate>();

		for (const { creatureName, count } of creatures) {
			const name = creatureName.trim();
			const entity = await entityService.findByNameAndType(
				db,
				campaignId,
				name,
				"monster",
			);
			if (entity) {
				const existing = matched.get(entity.id);
				if (existing) existing.count += count;
				else
					matched.set(entity.id, {
						entityId: entity.id,
						name: entity.name,
						type: entity.type,
						count,
					});
				continue;
			}
			const key = name.toLowerCase();
			const existing = unmatched.get(key);
			if (existing) existing.count += count;
			else unmatched.set(key, { name, count });
		}

		return {
			matched: [...matched.values()],
			newMonsterCandidates: [...unmatched.values()],
		};
	},

	/** Applies a `planFromCreatures` plan: creates each new monster (bare name, no stat data) then saves the encounter over matched + created members. Pass a transaction so the whole thing is atomic. */
	async savePlan(
		db: Database | Transaction,
		input: {
			campaignId: string;
			name: string;
			notes?: string;
		} & GeneratedEncounterPlan,
	) {
		const members = input.matched.map(({ entityId, count }) => ({
			entityId,
			count,
		}));
		for (const candidate of input.newMonsterCandidates) {
			const entity = await entityService.create(db, {
				campaignId: input.campaignId,
				name: candidate.name,
				type: "monster",
			});
			members.push({ entityId: entity.id, count: candidate.count });
		}
		return encounterService.save(db, {
			campaignId: input.campaignId,
			name: input.name,
			notes: input.notes,
			members,
		});
	},

	/** Additive-only: never mutates an existing encounter. Campaign and member entities are validated with campaign-filtered queries (no *Unscoped call). */
	async save(db: Database | Transaction, input: SaveEncounterInput) {
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
