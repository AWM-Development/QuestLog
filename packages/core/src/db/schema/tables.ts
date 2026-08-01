import { sql } from "drizzle-orm";
import {
	boolean,
	customType,
	index,
	integer,
	jsonb,
	pgTable,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";

/** Shape of the JSONB `sources` column on the `messages` table. */
export interface MessageSource {
	chunkId: string;
	sourceName: string;
	sourceId: string;
}

/**
 * Custom pgvector column type. Drizzle has no native pgvector support, so
 * serialization is handled manually:
 *   toDriver:   number[] → "[0.1,0.2,...]"  (Postgres vector literal)
 *   fromDriver: "[0.1,0.2,...]" → number[]  (handles null/empty defensively)
 */
const vector = (name: string, dimensions: number) =>
	customType<{ data: number[]; driverParam: string }>({
		dataType() {
			return `vector(${dimensions})`;
		},
		toDriver(value: number[]): string {
			return `[${value.join(",")}]`;
		},
		fromDriver(value: unknown): number[] {
			if (value === null || value === undefined) return [];
			const str = String(value).trim();
			if (!str || str === "[]") return [];
			return str
				.slice(1, -1)
				.split(",")
				.map((v) => Number.parseFloat(v.trim()))
				.filter((n) => !Number.isNaN(n));
		},
	})(name);

export const campaigns = pgTable("campaigns", {
	id: uuid("id").defaultRandom().primaryKey(),
	name: text("name").notNull(),
	description: text("description"),
	theme: text("theme").notNull(),
	gameSystem: text("game_system"),
	status: text("status").notNull().default("active"),
	createdAt: timestamp("created_at", { withTimezone: true })
		.defaultNow()
		.notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true })
		.defaultNow()
		.notNull()
		.$onUpdate(() => new Date()),
});

export const sessions = pgTable(
	"sessions",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		campaignId: uuid("campaign_id")
			.references(() => campaigns.id)
			.notNull(),
		sessionNumber: integer("session_number").notNull(),
		date: timestamp("date", { withTimezone: true }).defaultNow().notNull(),
		title: text("title"),
		summary: text("summary"),
		content: text("content").notNull(),
		status: text("status").notNull().default("draft"),
		tags: jsonb("tags").$type<string[]>().default([]),
		dismissedEntityTexts: jsonb("dismissed_entity_texts")
			.$type<string[]>()
			.default([]),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.notNull()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		index("sessions_campaign_id_idx").using("btree", table.campaignId),
	],
);

export const entities = pgTable(
	"entities",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		campaignId: uuid("campaign_id")
			.references(() => campaigns.id)
			.notNull(),
		name: text("name").notNull(),
		type: text("type").notNull(),
		summary: text("summary"),
		description: text("description"),
		attributes: jsonb("attributes")
			.$type<Record<string, unknown>>()
			.default({}),
		dmNotes: text("dm_notes"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.notNull()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		index("entities_name_trgm_idx").using(
			"gin",
			sql`${table.name} gin_trgm_ops`,
		),
		index("entities_campaign_id_idx").using("btree", table.campaignId),
	],
);

// No updatedAt: a session's entity links are recorded once at confirm time
// and not mutated afterward.
export const sessionEntities = pgTable("session_entities", {
	id: uuid("id").defaultRandom().primaryKey(),
	sessionId: uuid("session_id")
		.references(() => sessions.id)
		.notNull(),
	entityId: uuid("entity_id")
		.references(() => entities.id)
		.notNull(),
	matchType: text("match_type").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true })
		.defaultNow()
		.notNull(),
});

// No updatedAt: relationships are immutable edges in the knowledge graph.
// To change a relationship, delete and recreate it.
export const entityRelationships = pgTable(
	"entity_relationships",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		campaignId: uuid("campaign_id")
			.references(() => campaigns.id)
			.notNull(),
		sourceEntityId: uuid("source_entity_id")
			.references(() => entities.id)
			.notNull(),
		targetEntityId: uuid("target_entity_id")
			.references(() => entities.id)
			.notNull(),
		label: text("label").notNull(),
		description: text("description"),
		weight: integer("weight"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		index("entity_relationships_campaign_id_idx").using(
			"btree",
			table.campaignId,
		),
	],
);

export const sources = pgTable(
	"sources",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		campaignId: uuid("campaign_id")
			.references(() => campaigns.id)
			.notNull(),
		name: text("name").notNull(),
		type: text("type").notNull(), // "file" | "pasted_text" (source kind)
		mimeType: text("mime_type"),
		storageKey: text("storage_key"),
		sizeBytes: integer("size_bytes"),
		hash: text("hash"),
		status: text("status").notNull().default("pending"),
		metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.notNull()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		index("sources_campaign_id_idx").using("btree", table.campaignId),
	],
);

export const chunks = pgTable(
	"chunks",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		campaignId: uuid("campaign_id")
			.references(() => campaigns.id)
			.notNull(),
		sourceId: uuid("source_id").references(() => sources.id),
		sessionId: uuid("session_id").references(() => sessions.id),
		content: text("content").notNull(),
		embedding: vector("embedding", 1024),
		metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
		status: text("status").notNull().default("active"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		index("chunks_campaign_id_idx").using("btree", table.campaignId),
		index("chunks_status_idx").using("btree", table.status),
		index("chunks_content_trgm_idx").using(
			"gin",
			sql`${table.content} gin_trgm_ops`,
		),
		index("chunks_embedding_hnsw_idx").using(
			"hnsw",
			table.embedding.op("vector_cosine_ops"),
		),
	],
);

export const conversations = pgTable(
	"conversations",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		campaignId: uuid("campaign_id")
			.references(() => campaigns.id)
			.notNull(),
		title: text("title"),
		tags: jsonb("tags").$type<string[]>().default([]),
		status: text("status").notNull().default("active"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.notNull()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		index("conversations_campaign_id_idx").using("btree", table.campaignId),
	],
);

export const messages = pgTable("messages", {
	id: uuid("id").defaultRandom().primaryKey(),
	conversationId: uuid("conversation_id")
		.references(() => conversations.id)
		.notNull(),
	role: text("role").$type<"user" | "assistant">().notNull(),
	content: text("content").notNull(),
	sources: jsonb("sources").$type<MessageSource[]>(),
	inputTokens: integer("input_tokens"),
	outputTokens: integer("output_tokens"),
	createdAt: timestamp("created_at", { withTimezone: true })
		.defaultNow()
		.notNull(),
});

// Rows with `confirmedAt` set double as the audit log for MCP writes: what
// changed (payload/appliedResult), when (confirmedAt), which tool (toolName).
export const writeRequests = pgTable(
	"write_requests",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		campaignId: uuid("campaign_id")
			.references(() => campaigns.id)
			.notNull(),
		toolName: text("tool_name").notNull(),
		payload: jsonb("payload").$type<unknown>().notNull(),
		appliedResult: jsonb("applied_result").$type<unknown>(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
		confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
		// Set by an atomic conditional UPDATE at the start of confirm(), before
		// applyFn runs — the claim mechanism itself, distinct from confirmedAt.
		// Cleared (not confirmedAt) if applyFn throws, so the token stays
		// retryable. See write-request.service.ts.
		claimedAt: timestamp("claimed_at", { withTimezone: true }),
	},
	(table) => [
		index("write_requests_campaign_id_idx").using("btree", table.campaignId),
	],
);

// Single fixed-identity OAuth 2.1 shim for the remote MCP endpoint (M-REMOTE.2)
// — Dynamic Client Registration, not a real multi-tenant IdP. Clients are
// public (PKCE, no client_secret), so client_id is a public identifier, not
// a secret. The bearer-secret columns (code, access_token, refresh_token)
// store a SHA-256 hash of the opaque random value handed to the caller,
// never the raw value, so a DB leak alone doesn't yield usable credentials.
export const mcpOauthClients = pgTable("mcp_oauth_clients", {
	clientId: text("client_id").primaryKey(),
	redirectUri: text("redirect_uri").notNull(),
	registeredAt: timestamp("registered_at", { withTimezone: true })
		.defaultNow()
		.notNull(),
});

export const mcpOauthCodes = pgTable(
	"mcp_oauth_codes",
	{
		code: text("code").primaryKey(),
		clientId: text("client_id")
			.references(() => mcpOauthClients.clientId)
			.notNull(),
		codeChallenge: text("code_challenge").notNull(),
		resource: text("resource").notNull(),
		expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
		used: boolean("used").notNull().default(false),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		index("mcp_oauth_codes_client_id_idx").using("btree", table.clientId),
	],
);

export const mcpOauthTokens = pgTable(
	"mcp_oauth_tokens",
	{
		accessToken: text("access_token").primaryKey(),
		refreshToken: text("refresh_token").notNull().unique(),
		clientId: text("client_id")
			.references(() => mcpOauthClients.clientId)
			.notNull(),
		expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		index("mcp_oauth_tokens_client_id_idx").using("btree", table.clientId),
	],
);
