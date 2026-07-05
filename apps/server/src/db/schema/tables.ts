import {
	customType,
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

export const sessions = pgTable("sessions", {
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
});

export const entities = pgTable("entities", {
	id: uuid("id").defaultRandom().primaryKey(),
	campaignId: uuid("campaign_id")
		.references(() => campaigns.id)
		.notNull(),
	name: text("name").notNull(),
	type: text("type").notNull(),
	summary: text("summary"),
	description: text("description"),
	attributes: jsonb("attributes").$type<Record<string, unknown>>().default({}),
	dmNotes: text("dm_notes"),
	createdAt: timestamp("created_at", { withTimezone: true })
		.defaultNow()
		.notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true })
		.defaultNow()
		.notNull()
		.$onUpdate(() => new Date()),
});

// No updatedAt: relationships are immutable edges in the knowledge graph.
// To change a relationship, delete and recreate it.
export const entityRelationships = pgTable("entity_relationships", {
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
});

export const sources = pgTable("sources", {
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
});

export const chunks = pgTable("chunks", {
	id: uuid("id").defaultRandom().primaryKey(),
	campaignId: uuid("campaign_id")
		.references(() => campaigns.id)
		.notNull(),
	sourceId: uuid("source_id").references(() => sources.id),
	sessionId: uuid("session_id").references(() => sessions.id),
	content: text("content").notNull(),
	embedding: vector("embedding", 1024),
	metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
	createdAt: timestamp("created_at", { withTimezone: true })
		.defaultNow()
		.notNull(),
});

export const conversations = pgTable("conversations", {
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
});

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
