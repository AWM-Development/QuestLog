import { desc, eq, inArray } from "drizzle-orm";
import type { Database } from "../db/index.js";
import { entities, sessions } from "../db/schema/index.js";
import { campaignService } from "./campaign.service.js";
import { entityService } from "./entity.service.js";

const RESOLVED_PREFIX = "resolved:";
const CONTENT_EXCERPT_LENGTH = 500;

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
}

function excerpt(text: string, length = CONTENT_EXCERPT_LENGTH): string {
	if (text.length <= length) return text;
	return `${text.slice(0, length).trimEnd()}…`;
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

		// Likely NPCs: session_entities (T-003) isn't on develop yet, so fall
		// back to re-detecting spans against recent session content.
		const npcsBySessionRecency = new Map<string, LikelyNpc>();
		for (const session of recentSessions) {
			const spans = await entityService.detectSpans(db, {
				campaignId,
				text: session.content,
			});
			const confirmedEntityIds = Array.from(
				new Set(
					spans
						.filter((span) => span.matchType === "confirmed")
						.map((span) => span.entityId),
				),
			);
			if (confirmedEntityIds.length === 0) continue;

			const matchedEntities = await db
				.select()
				.from(entities)
				.where(inArray(entities.id, confirmedEntityIds));

			for (const entity of matchedEntities) {
				if (entity.type !== "npc") continue;
				// recentSessions is newest-first, so the first hit per entity is its
				// most recent mention.
				if (npcsBySessionRecency.has(entity.id)) continue;
				npcsBySessionRecency.set(entity.id, {
					entityId: entity.id,
					name: entity.name,
					summary: entity.summary,
					lastSessionNumber: session.sessionNumber,
				});
			}
		}
		const likelyNpcs = Array.from(npcsBySessionRecency.values());

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
		};
	},
};
