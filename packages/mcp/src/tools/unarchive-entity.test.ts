import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { basisVector, deleteCampaignTree } from "@questlog/core/db/test-helpers.js";
import { campaignService } from "@questlog/core/services/campaign.service.js";
import { connectedClient, createMockFetch, db } from "../test-helpers.js";
import { entities } from "@questlog/core/db/schema/index.js";
import { entityService } from "@questlog/core/services/entity.service.js";
import { eq } from "drizzle-orm";
import { writeRequestService } from "@questlog/core/services/write-request.service.js";

describe("unarchive_entity + confirm_unarchive_entity tools", () => {
	// Same nested-transaction concern as update_entity/confirm_update_entity
	// above — confirm_unarchive_entity opens its own db.transaction().
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

	it("previews the proposed unarchive without persisting anything", async () => {
		const entity = await entityService.create(db, {
			campaignId,
			name: "Mira Duskwood",
			type: "npc",
		});
		await entityService.archive(db, campaignId, entity.id);

		const client = await connectedClient(createMockFetch(basisVector(0)));
		const result = await client.callTool({
			name: "unarchive_entity",
			arguments: { campaignId, entityId: entity.id },
		});

		expect(result.isError).toBeFalsy();
		const content = result.content as Array<{ type: string; text: string }>;
		const payload = JSON.parse(content[0]?.text ?? "{}");

		expect(payload.token).toBeDefined();
		expect(payload.preview.before).toMatchObject({ status: "archived" });
		expect(payload.preview.after).toMatchObject({ status: "active" });

		const [unchanged] = await db
			.select()
			.from(entities)
			.where(eq(entities.id, entity.id));
		expect(unchanged?.status).toBe("archived");
	});

	it("sets the entity's status back to active on confirm", async () => {
		const entity = await entityService.create(db, {
			campaignId,
			name: "Mira Duskwood",
			type: "npc",
		});
		await entityService.archive(db, campaignId, entity.id);

		const client = await connectedClient(createMockFetch(basisVector(0)));
		const previewResult = await client.callTool({
			name: "unarchive_entity",
			arguments: { campaignId, entityId: entity.id },
		});
		const previewContent = previewResult.content as Array<{
			type: string;
			text: string;
		}>;
		const { token } = JSON.parse(previewContent[0]?.text ?? "{}");

		const confirmResult = await client.callTool({
			name: "confirm_unarchive_entity",
			arguments: { token },
		});

		expect(confirmResult.isError).toBeFalsy();
		const confirmContent = confirmResult.content as Array<{
			type: string;
			text: string;
		}>;
		const confirmed = JSON.parse(confirmContent[0]?.text ?? "{}");
		expect(confirmed.status).toBe("active");

		const [updated] = await db
			.select()
			.from(entities)
			.where(eq(entities.id, entity.id));
		expect(updated?.status).toBe("active");
	});

	it("rejects a preview for a bogus entityId before a write request is even created", async () => {
		const client = await connectedClient(createMockFetch(basisVector(0)));
		const unknownEntityId = "00000000-0000-0000-0000-000000000000";

		const result = await client.callTool({
			name: "unarchive_entity",
			arguments: { campaignId, entityId: unknownEntityId },
		});

		expect(result.isError).toBe(true);
		const content = result.content as Array<{ type: string; text: string }>;
		const payload = JSON.parse(content[0]?.text ?? "{}");
		expect(payload.error.code).toBe("NOT_FOUND");
	});

	it("returns a well-formed not-found error from confirm_unarchive_entity for a bogus entityId", async () => {
		const unknownEntityId = "00000000-0000-0000-0000-000000000000";
		const { token } = await writeRequestService.createPreview(db, {
			campaignId,
			toolName: "unarchive_entity",
			payload: { campaignId, entityId: unknownEntityId },
		});

		const client = await connectedClient(createMockFetch(basisVector(0)));
		const result = await client.callTool({
			name: "confirm_unarchive_entity",
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
		await entityService.archive(db, campaignId, entity.id);

		const client = await connectedClient(createMockFetch(basisVector(0)));
		const previewResult = await client.callTool({
			name: "unarchive_entity",
			arguments: { campaignId, entityId: entity.id },
		});
		const previewContent = previewResult.content as Array<{
			type: string;
			text: string;
		}>;
		const { token } = JSON.parse(previewContent[0]?.text ?? "{}");

		await client.callTool({
			name: "confirm_unarchive_entity",
			arguments: { token },
		});
		const secondResult = await client.callTool({
			name: "confirm_unarchive_entity",
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
		expect(updated?.status).toBe("active");
	});
});
