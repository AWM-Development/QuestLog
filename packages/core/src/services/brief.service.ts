import { and, desc, eq, inArray } from "drizzle-orm";
import type { Database } from "../db/index.js";
import type { campaignWealth, inventoryItems } from "../db/schema/index.js";
import { entities, sessionEntities, sessions } from "../db/schema/index.js";
import { campaignService } from "./campaign.service.js";
import { inventoryService } from "./inventory.service.js";

const RESOLVED_PREFIX = "resolved:";
const CONTENT_EXCERPT_LENGTH = 500;
// Consistent with prep_brief's existing brevity goal — a simple cap, not a
// general pagination mechanism (T-144 scope).
const UNASSIGNED_ITEMS_CAP = 10;

export interface BriefInput {
	campaignId: string;
	/** How many of the most recent sessions feed "Previously on" and "Likely NPCs". Default 2. */
	sessionCount?: number;
}

export interface PreviouslyOnEntry {
	sessionNumber: number;
	date: Date;
	title: string | null;
	text: string;
}

export interface ActiveThread {
	tag: string;
	lastTouchedSessionNumber: number;
	lastTouchedDate: Date;
}

export interface LikelyNpc {
	entityId: string;
	name: string;
	summary: string | null;
	/** DM-only prep note, not for reading aloud to the party (T-162, G-032). */
	dmNotes: string | null;
	lastSessionNumber: number;
}

export interface QuickLink {
	entityId: string;
	name: string;
}

export interface UnimplementedSection {
	items: [];
	note: string;
}

export interface Brief {
	previouslyOn: PreviouslyOnEntry[];
	activeThreads: ActiveThread[];
	likelyNpcs: LikelyNpc[];
	looseEnds: UnimplementedSection;
	suggestedFollowUps: UnimplementedSection;
	quickLinks: QuickLink[];
	/** All `campaign_wealth` rows for the campaign (T-144, M-INVENTORY.3). */
	wealth: (typeof campaignWealth.$inferSelect)[];
	/** Unassigned/party-pool items (`ownerEntityId IS NULL`), capped at `UNASSIGNED_ITEMS_CAP` (T-144). */
	unassignedItems: (typeof inventoryItems.$inferSelect)[];
}

function excerpt(text: string, length = CONTENT_EXCERPT_LENGTH): string {
	if (text.length <= length) return text;
	let cut = text.slice(0, length);
	// Don't split a surrogate pair (e.g. an emoji) at the cut point.
	if (/[\uD800-\uDBFF]$/.test(cut)) cut = cut.slice(0, -1);
	return `${cut.trimEnd()}…`;
}

export const briefService = {
	async assemble(db: Database, input: BriefInput): Promise<Brief> {
		const { campaignId, sessionCount = 2 } = input;

		await campaignService.getById(db, campaignId);

		// Newest-first: index 0 is the most recently played session.
		const allSessions = await db
			.select()
			.from(sessions)
			.where(eq(sessions.campaignId, campaignId))
			.orderBy(desc(sessions.sessionNumber));

		const recentSessions = allSessions.slice(0, sessionCount);

		const previouslyOn: PreviouslyOnEntry[] = recentSessions.map((s) => ({
			sessionNumber: s.sessionNumber,
			date: s.date,
			title: s.title,
			text: s.summary ?? excerpt(s.content),
		}));

		// Active plot threads draw on the full session history (PRD §4.4: "All
		// session logs"), not just the recent window used above.
		const resolvedTags = new Set<string>();
		const threadsByTag = new Map<string, ActiveThread>();
		for (const session of [...allSessions].reverse()) {
			for (const tag of session.tags ?? []) {
				if (tag.startsWith(RESOLVED_PREFIX)) {
					resolvedTags.add(tag.slice(RESOLVED_PREFIX.length));
					continue;
				}
				threadsByTag.set(tag, {
					tag,
					lastTouchedSessionNumber: session.sessionNumber,
					lastTouchedDate: session.date,
				});
			}
		}
		const activeThreads = Array.from(threadsByTag.values())
			.filter((thread) => !resolvedTags.has(thread.tag))
			.sort((a, b) => b.lastTouchedSessionNumber - a.lastTouchedSessionNumber);

		// Likely NPCs: read confirmed links from session_entities (populated at
		// confirm time by confirm_log_session) instead of re-deriving them by
		// re-scanning session content on every prep_brief call.
		const recentSessionIds = recentSessions.map((s) => s.id);
		const npcMentions =
			recentSessionIds.length === 0
				? []
				: await db
						.select({
							sessionId: sessionEntities.sessionId,
							entityId: entities.id,
							name: entities.name,
							summary: entities.summary,
							dmNotes: entities.dmNotes,
						})
						.from(sessionEntities)
						.innerJoin(entities, eq(sessionEntities.entityId, entities.id))
						.where(
							and(
								inArray(sessionEntities.sessionId, recentSessionIds),
								eq(sessionEntities.matchType, "confirmed"),
								eq(entities.type, "npc"),
							),
						);

		const npcMentionsBySession = new Map<string, typeof npcMentions>();
		for (const mention of npcMentions) {
			const mentions = npcMentionsBySession.get(mention.sessionId) ?? [];
			mentions.push(mention);
			npcMentionsBySession.set(mention.sessionId, mentions);
		}

		// recentSessions is newest-first, so the first hit per entity is its
		// most recent mention.
		const npcsBySessionRecency = new Map<string, LikelyNpc>();
		for (const session of recentSessions) {
			for (const mention of npcMentionsBySession.get(session.id) ?? []) {
				if (npcsBySessionRecency.has(mention.entityId)) continue;
				npcsBySessionRecency.set(mention.entityId, {
					entityId: mention.entityId,
					name: mention.name,
					summary: mention.summary,
					dmNotes: mention.dmNotes,
					lastSessionNumber: session.sessionNumber,
				});
			}
		}
		const likelyNpcs = Array.from(npcsBySessionRecency.values());

		const { items, wealth } = await inventoryService.listInventory(db, {
			campaignId,
		});
		const unassignedItems = items
			.filter((item) => item.ownerEntityId === null)
			.slice(0, UNASSIGNED_ITEMS_CAP);

		return {
			previouslyOn,
			activeThreads,
			likelyNpcs,
			looseEnds: {
				items: [],
				note: "Loose ends & flags require agent analysis across sessions — not implemented in v1.",
			},
			suggestedFollowUps: {
				items: [],
				note: "Suggested follow-ups are agent-generated — not implemented in v1.",
			},
			quickLinks: likelyNpcs.map((npc) => ({
				entityId: npc.entityId,
				name: npc.name,
			})),
			wealth,
			unassignedItems,
		};
	},
};
