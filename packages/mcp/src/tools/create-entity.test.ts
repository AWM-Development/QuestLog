import { chunks, entities, sources } from "@questlog/core/db/schema/index.js";
import {
	basisVector,
	deleteCampaignTree,
} from "@questlog/core/db/test-helpers.js";
import { campaignService } from "@questlog/core/services/campaign.service.js";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { connectedClient, createMockFetch, db } from "../test-helpers.js";

describe("create_entity tool", () => {
	// create_entity now searches lore before persisting (T-083), whose
	// keywordSearch opens its own db.transaction() (T-015) — doesn't compose
	// with a raw BEGIN/ROLLBACK wrapper (.claude/rules/backend.md "Test DB
	// pattern"), same reason query_lore's describe block above uses this.
	let campaignId: string;
	let sourceId: string;

	beforeEach(async () => {
		vi.clearAllMocks();

		const campaign = await campaignService.create(db, {
			name: "Ashfall Primer Campaign",
			theme: "fantasy",
		});
		campaignId = campaign.id;

		const [source] = await db
			.insert(sources)
			.values({ campaignId, name: "primer.md", type: "file", status: "done" })
			.returning();
		sourceId = source?.id ?? "";
	});

	afterEach(async () => {
		await deleteCampaignTree(db, campaignId);
	});

	it("creates a row immediately visible via get_entity and list_entities", async () => {
		const client = await connectedClient(createMockFetch(basisVector(0)));

		const createResult = await client.callTool({
			name: "create_entity",
			arguments: {
				campaignId,
				name: "Mira Duskwood",
				type: "npc",
				description: "A road warden.",
			},
		});

		expect(createResult.isError).toBeFalsy();
		const createContent = createResult.content as Array<{
			type: string;
			text: string;
		}>;
		const created = JSON.parse(createContent[0]?.text ?? "{}");
		expect(created.id).toBeDefined();
		expect(created.name).toBe("Mira Duskwood");

		const getResult = await client.callTool({
			name: "get_entity",
			arguments: { campaignId, entityId: created.id },
		});
		expect(getResult.isError).toBeFalsy();
		const getContent = getResult.content as Array<{
			type: string;
			text: string;
		}>;
		const fetched = JSON.parse(getContent[0]?.text ?? "{}");
		expect(fetched.id).toBe(created.id);
		expect(fetched.description).toBe("A road warden.");

		const listResult = await client.callTool({
			name: "list_entities",
			arguments: { campaignId },
		});
		expect(listResult.isError).toBeFalsy();
		const listContent = listResult.content as Array<{
			type: string;
			text: string;
		}>;
		const listed = JSON.parse(listContent[0]?.text ?? "{}");
		expect(listed.entities).toEqual(
			expect.arrayContaining([expect.objectContaining({ id: created.id })]),
		);
	});

	it("rejects an invalid type before it reaches the service", async () => {
		const client = await connectedClient(createMockFetch(basisVector(0)));

		const result = await client.callTool({
			name: "create_entity",
			arguments: { campaignId, name: "Mira Duskwood", type: "wizard" },
		});

		expect(result.isError).toBe(true);

		const rows = await db
			.select()
			.from(entities)
			.where(eq(entities.campaignId, campaignId));
		expect(rows).toHaveLength(0);
	});

	it("seeds the description from a high-confidence lore match and returns citations + seeded: true (T-083)", async () => {
		const [chunk] = await db
			.insert(chunks)
			.values({
				campaignId,
				sourceId,
				content: "Mira Duskwood patrols the Old Road near Ashfall Peak.",
				embedding: basisVector(0),
				metadata: { position: 0 },
			})
			.returning();

		const client = await connectedClient(createMockFetch(basisVector(0)));

		const result = await client.callTool({
			name: "create_entity",
			arguments: { campaignId, name: "Mira Duskwood", type: "npc" },
		});

		expect(result.isError).toBeFalsy();
		const content = result.content as Array<{ type: string; text: string }>;
		const created = JSON.parse(content[0]?.text ?? "{}");
		expect(created.seeded).toBe(true);
		expect(created.description).toContain("Mira Duskwood patrols the Old Road");
		expect(created.citations).toEqual(
			expect.arrayContaining([expect.objectContaining({ chunkId: chunk?.id })]),
		);
		expect(created.confidence).toBeGreaterThan(0);
	});

	it("returns low-confidence matches as citations without seeding (T-083)", async () => {
		const [chunk] = await db
			.insert(chunks)
			.values({
				campaignId,
				sourceId,
				content: "The tavern serves watered-down ale.",
				// Orthogonal to the query embedding (basisVector(0)) -> score 0.
				embedding: basisVector(1),
				metadata: { position: 0 },
			})
			.returning();

		const client = await connectedClient(createMockFetch(basisVector(0)));

		const result = await client.callTool({
			name: "create_entity",
			arguments: { campaignId, name: "Mira Duskwood", type: "npc" },
		});

		expect(result.isError).toBeFalsy();
		const content = result.content as Array<{ type: string; text: string }>;
		const created = JSON.parse(content[0]?.text ?? "{}");
		expect(created.seeded).toBe(false);
		expect(created.description).toBeNull();
		expect(created.citations).toEqual(
			expect.arrayContaining([expect.objectContaining({ chunkId: chunk?.id })]),
		);
	});

	it("persists a supplied dmNotes value and returns it in the response (T-161)", async () => {
		const client = await connectedClient(createMockFetch(basisVector(0)));

		const createResult = await client.callTool({
			name: "create_entity",
			arguments: {
				campaignId,
				name: "Mira Duskwood",
				type: "npc",
				description: "A road warden.",
				dmNotes: "Secretly reports to Baron Voss.",
			},
		});

		expect(createResult.isError).toBeFalsy();
		const content = createResult.content as Array<{
			type: string;
			text: string;
		}>;
		const created = JSON.parse(content[0]?.text ?? "{}");
		expect(created.description).toBe("A road warden.");
		expect(created.dmNotes).toBe("Secretly reports to Baron Voss.");
	});
});
