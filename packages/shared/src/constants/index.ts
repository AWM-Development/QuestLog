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
	"story_arc",
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
