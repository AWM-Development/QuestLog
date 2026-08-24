import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { basisVector, deleteCampaignTree } from "@questlog/core/db/test-helpers.js";
import { campaignService } from "@questlog/core/services/campaign.service.js";
import { connectedClient, createMockFetch, db } from "../test-helpers.js";
import { entities } from "@questlog/core/db/schema/index.js";
import { entityService } from "@questlog/core/services/entity.service.js";
import { eq } from "drizzle-orm";
import { writeRequestService } from "@questlog/core/services/write-request.service.js";

describe("update_entity + confirm_update_entity tools", () => {
	// confirm_update_entity opens its own db.transaction() (via
	// writeRequestService.confirm), which does not compose with a raw
	// BEGIN/ROLLBACK wrapper on the same connection (.claude/rules/backend.md
	// "Test DB pattern") — use explicit FK-safe cleanup instead.
	let campaignId: string;

	beforeEach(async () => {
		vi.clearAllMocks();

		const campaign = await campaignService.create(db, {
			name: "Ashfall Primer Campaign",
			theme: "fantasy",
		});
		campaignId = campaign.id;
	});

	afterEach(async () => {
		await deleteCampaignTree(db, campaignId);
	});

	it("previews the proposed changes without persisting anything", async () => {
		const entity = await entityService.create(db, {
			campaignId,
			name: "Mira Duskwood",
			type: "npc",
			description: "A road warden.",
		});

		const client = await connectedClient(createMockFetch(basisVector(0)));
		const result = await client.callTool({
			name: "update_entity",
			arguments: {
				campaignId,
				entityId: entity.id,
				name: "Mira Duskwood-Voss",
			},
		});

		expect(result.isError).toBeFalsy();
		const content = result.content as Array<{ type: string; text: string }>;
		const payload = JSON.parse(content[0]?.text ?? "{}");

		expect(payload.token).toBeDefined();
		expect(payload.preview.before).toMatchObject({
			name: "Mira Duskwood",
			description: "A road warden.",
		});
		expect(payload.preview.after).toMatchObject({
			name: "Mira Duskwood-Voss",
			description: "A road warden.",
		});

		const [unchanged] = await db
			.select()
			.from(entities)
			.where(eq(entities.id, entity.id));
		expect(unchanged?.name).toBe("Mira Duskwood");
	});

	it("persists only the provided fields on confirm, leaving the rest unchanged", async () => {
		const entity = await entityService.create(db, {
			campaignId,
			name: "Mira Duskwood",
			type: "npc",
			description: "A road warden.",
		});

		const client = await connectedClient(createMockFetch(basisVector(0)));
		const previewResult = await client.callTool({
			name: "update_entity",
			arguments: {
				campaignId,
				entityId: entity.id,
				description: "A road warden turned mercenary.",
			},
		});
		const previewContent = previewResult.content as Array<{
			type: string;
			text: string;
		}>;
		const { token } = JSON.parse(previewContent[0]?.text ?? "{}");

		const confirmResult = await client.callTool({
			name: "confirm_update_entity",
			arguments: { token },
		});

		expect(confirmResult.isError).toBeFalsy();
		const confirmContent = confirmResult.content as Array<{
			type: string;
			text: string;
		}>;
		const confirmed = JSON.parse(confirmContent[0]?.text ?? "{}");
		expect(confirmed.description).toBe("A road warden turned mercenary.");
		expect(confirmed.name).toBe("Mira Duskwood");
		expect(confirmed.type).toBe("npc");

		const [updated] = await db
			.select()
			.from(entities)
			.where(eq(entities.id, entity.id));
		expect(updated?.name).toBe("Mira Duskwood");
		expect(updated?.description).toBe("A road warden turned mercenary.");
	});

	it("previews dmNotes in both before and after, and confirm persists it (T-161)", async () => {
		const entity = await entityService.create(db, {
			campaignId,
			name: "Mira Duskwood",
			type: "npc",
			dmNotes: "Secretly reports to Baron Voss.",
		});

		const client = await connectedClient(createMockFetch(basisVector(0)));
		const previewResult = await client.callTool({
			name: "update_entity",
			arguments: {
				campaignId,
				entityId: entity.id,
				dmNotes: "Secretly reports to Baron Voss, now defected.",
			},
		});

		expect(previewResult.isError).toBeFalsy();
		const previewContent = previewResult.content as Array<{
			type: string;
			text: string;
		}>;
		const { token, preview } = JSON.parse(previewContent[0]?.text ?? "{}");
		expect(preview.before.dmNotes).toBe("Secretly reports to Baron Voss.");
		expect(preview.after.dmNotes).toBe(
			"Secretly reports to Baron Voss, now defected.",
		);

		const confirmResult = await client.callTool({
			name: "confirm_update_entity",
			arguments: { token },
		});
		expect(confirmResult.isError).toBeFalsy();
		const confirmContent = confirmResult.content as Array<{
			type: string;
			text: string;
		}>;
		const confirmed = JSON.parse(confirmContent[0]?.text ?? "{}");
		expect(confirmed.dmNotes).toBe(
			"Secretly reports to Baron Voss, now defected.",
		);
	});

	it("rejects an invalid type before it reaches the service", async () => {
		const entity = await entityService.create(db, {
			campaignId,
			name: "Mira Duskwood",
			type: "npc",
		});

		const client = await connectedClient(createMockFetch(basisVector(0)));
		const result = await client.callTool({
			name: "update_entity",
			arguments: { campaignId, entityId: entity.id, type: "wizard" },
		});

		expect(result.isError).toBe(true);

		const [unchanged] = await db
			.select()
			.from(entities)
			.where(eq(entities.id, entity.id));
		expect(unchanged?.type).toBe("npc");
	});

	it("rejects a preview with no fields to update before it reaches the service", async () => {
		const entity = await entityService.create(db, {
			campaignId,
			name: "Mira Duskwood",
			type: "npc",
		});

		const client = await connectedClient(createMockFetch(basisVector(0)));
		const result = await client.callTool({
			name: "update_entity",
			arguments: { campaignId, entityId: entity.id },
		});

		expect(result.isError).toBe(true);

		const [unchanged] = await db
			.select()
			.from(entities)
			.where(eq(entities.id, entity.id));
		expect(unchanged?.name).toBe("Mira Duskwood");
	});

	it("rejects a preview for a bogus entityId before a write request is even created", async () => {
		const client = await connectedClient(createMockFetch(basisVector(0)));
		const unknownEntityId = "00000000-0000-0000-0000-000000000000";

		const result = await client.callTool({
			name: "update_entity",
			arguments: { campaignId, entityId: unknownEntityId, name: "Ghost" },
		});

		expect(result.isError).toBe(true);
		const content = result.content as Array<{ type: string; text: string }>;
		const payload = JSON.parse(content[0]?.text ?? "{}");
		expect(payload.error.code).toBe("NOT_FOUND");
	});

	it("returns a well-formed not-found error from confirm_update_entity for a bogus entityId", async () => {
		// Bypasses update_entity's own fail-fast getById check (see the test
		// above) to exercise entityService.update's independent not-found guard
		// inside the confirm transaction — the defense-in-depth path a stale or
		// hand-crafted token would hit.
		const unknownEntityId = "00000000-0000-0000-0000-000000000000";
		const { token } = await writeRequestService.createPreview(db, {
			campaignId,
			toolName: "update_entity",
			payload: {
				campaignId,
				entityId: unknownEntityId,
				fields: { name: "Ghost" },
			},
		});

		const client = await connectedClient(createMockFetch(basisVector(0)));
		const result = await client.callTool({
			name: "confirm_update_entity",
			arguments: { token },
		});

		expect(result.isError).toBe(true);
		const content = result.content as Array<{ type: string; text: string }>;
		const payload = JSON.parse(content[0]?.text ?? "{}");
		expect(payload.error.code).toBe("NOT_FOUND");
	});

	it("returns a well-formed not-found error on a second confirm with the same token and does not double-apply", async () => {
		const entity = await entityService.create(db, {
			campaignId,
			name: "Mira Duskwood",
			type: "npc",
		});

		const client = await connectedClient(createMockFetch(basisVector(0)));
		const previewResult = await client.callTool({
			name: "update_entity",
			arguments: { campaignId, entityId: entity.id, name: "Mira Voss" },
		});
		const previewContent = previewResult.content as Array<{
			type: string;
			text: string;
		}>;
		const { token } = JSON.parse(previewContent[0]?.text ?? "{}");

		await client.callTool({
			name: "confirm_update_entity",
			arguments: { token },
		});
		const secondResult = await client.callTool({
			name: "confirm_update_entity",
			arguments: { token },
		});

		expect(secondResult.isError).toBe(true);
		const secondContent = secondResult.content as Array<{
			type: string;
			text: string;
		}>;
		const secondPayload = JSON.parse(secondContent[0]?.text ?? "{}");
		expect(secondPayload.error.code).toBe("NOT_FOUND");

		const [updated] = await db
			.select()
			.from(entities)
			.where(eq(entities.id, entity.id));
		expect(updated?.name).toBe("Mira Voss");
	});
});
