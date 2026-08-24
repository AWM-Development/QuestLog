import { basisVector } from "@questlog/core/db/test-helpers.js";
import { campaignService } from "@questlog/core/services/campaign.service.js";
import { entityService } from "@questlog/core/services/entity.service.js";
import { sql } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { connectedClient, createMockFetch, db } from "../test-helpers.js";

describe("append_entity_note tool", () => {
	let campaignId: string;

	beforeEach(async () => {
		await db.execute(sql`BEGIN`);
		vi.clearAllMocks();

		const campaign = await campaignService.create(db, {
			name: "Ashfall Primer Campaign",
			theme: "fantasy",
		});
		campaignId = campaign.id;
	});

	afterEach(async () => {
		await db.execute(sql`ROLLBACK`);
	});

	it("appends to an existing entity's description without overwriting prior content", async () => {
		const entity = await entityService.create(db, {
			campaignId,
			name: "Mira Duskwood",
			type: "npc",
			description: "A road warden.",
		});

		const client = await connectedClient(createMockFetch(basisVector(0)));
		const result = await client.callTool({
			name: "append_entity_note",
			arguments: {
				entityId: entity.id,
				note: "She used to serve under Baron Voss.",
			},
		});

		expect(result.isError).toBeFalsy();
		const content = result.content as Array<{ type: string; text: string }>;
		const payload = JSON.parse(content[0]?.text ?? "{}");
		expect(payload.description).toBe(
			"A road warden.\n\nShe used to serve under Baron Voss.",
		);
	});

	it("appends to description when visibility is explicitly 'party' (T-161 regression check)", async () => {
		const entity = await entityService.create(db, {
			campaignId,
			name: "Mira Duskwood",
			type: "npc",
			description: "A road warden.",
		});

		const client = await connectedClient(createMockFetch(basisVector(0)));
		const result = await client.callTool({
			name: "append_entity_note",
			arguments: {
				entityId: entity.id,
				note: "She used to serve under Baron Voss.",
				visibility: "party",
			},
		});

		expect(result.isError).toBeFalsy();
		const content = result.content as Array<{ type: string; text: string }>;
		const payload = JSON.parse(content[0]?.text ?? "{}");
		expect(payload.description).toBe(
			"A road warden.\n\nShe used to serve under Baron Voss.",
		);
		expect(payload.dmNotes).toBeNull();
	});

	it("appends to dmNotes when visibility is 'dm', leaving description unchanged (T-161)", async () => {
		const entity = await entityService.create(db, {
			campaignId,
			name: "Mira Duskwood",
			type: "npc",
			description: "A road warden.",
		});

		const client = await connectedClient(createMockFetch(basisVector(0)));
		const result = await client.callTool({
			name: "append_entity_note",
			arguments: {
				entityId: entity.id,
				note: "Secretly reports to Baron Voss.",
				visibility: "dm",
			},
		});

		expect(result.isError).toBeFalsy();
		const content = result.content as Array<{ type: string; text: string }>;
		const payload = JSON.parse(content[0]?.text ?? "{}");
		expect(payload.dmNotes).toBe("Secretly reports to Baron Voss.");
		expect(payload.description).toBe("A road warden.");
	});

	it("concatenates two 'dm' visibility notes with a blank line across calls (T-161)", async () => {
		const entity = await entityService.create(db, {
			campaignId,
			name: "Mira Duskwood",
			type: "npc",
		});

		const client = await connectedClient(createMockFetch(basisVector(0)));
		await client.callTool({
			name: "append_entity_note",
			arguments: {
				entityId: entity.id,
				note: "First dm note.",
				visibility: "dm",
			},
		});
		const result = await client.callTool({
			name: "append_entity_note",
			arguments: {
				entityId: entity.id,
				note: "Second dm note.",
				visibility: "dm",
			},
		});

		expect(result.isError).toBeFalsy();
		const content = result.content as Array<{ type: string; text: string }>;
		const payload = JSON.parse(content[0]?.text ?? "{}");
		expect(payload.dmNotes).toBe("First dm note.\n\nSecond dm note.");
	});

	it("returns a well-formed not-found error for a bogus entityId", async () => {
		const client = await connectedClient(createMockFetch(basisVector(0)));
		const unknownEntityId = "00000000-0000-0000-0000-000000000000";

		const result = await client.callTool({
			name: "append_entity_note",
			arguments: { entityId: unknownEntityId, note: "Some note." },
		});

		expect(result.isError).toBe(true);
		const content = result.content as Array<{ type: string; text: string }>;
		const payload = JSON.parse(content[0]?.text ?? "{}");
		expect(payload.error.code).toBe("NOT_FOUND");
	});
});
