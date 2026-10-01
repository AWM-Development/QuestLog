export const CAMPAIGN_THEMES = [
	"fantasy",
	"sci-fi",
	"western",
	"horror",
	"modern",
] as const;
export type CampaignTheme = (typeof CAMPAIGN_THEMES)[number];

export const CAMPAIGN_STATUSES = ["active", "archived"] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

export const ENTITY_TYPES = [
	"npc",
	"location",
	"faction",
	"item",
	"arc",
	"pc",
	"monster",
] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

export const SOURCE_TYPES = [
	"pdf",
	"markdown",
	"text",
	"docx",
	"paste",
] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

export const SOURCE_STATUSES = [
	"pending",
	"extracting",
	"chunking",
	"embedding",
	"done",
	"error",
] as const;
export type SourceStatus = (typeof SOURCE_STATUSES)[number];

export const CONVERSATION_STATUSES = ["active", "archived"] as const;
export type ConversationStatus = (typeof CONVERSATION_STATUSES)[number];

export const SESSION_STATUSES = ["draft", "finalized"] as const;
export type SessionStatus = (typeof SESSION_STATUSES)[number];

export const MESSAGE_ROLES = ["user", "assistant"] as const;
export type MessageRole = (typeof MESSAGE_ROLES)[number];

/** `Docs/tickets/TICKET_SPEC.md`'s Complexity tier rubric (T-050/M-OBS.6). Lowercase to match how it's already stored/consumed (`ticket_runs.complexity_tier`, CSS class names) — the ticket file field itself is written uppercase. */
export const COMPLEXITY_TIERS = ["xs", "s", "m", "l", "d"] as const;
export type ComplexityTier = (typeof COMPLEXITY_TIERS)[number];
