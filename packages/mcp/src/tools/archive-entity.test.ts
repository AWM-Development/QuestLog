import { entities } from "@questlog/core/db/schema/index.js";
import {
	basisVector,
	deleteCampaignTree,
} from "@questlog/core/db/test-helpers.js";
import { campaignService } from "@questlog/core/services/campaign.service.js";
import { entityService } from "@questlog/core/services/entity.service.js";
import { writeRequestService } from "@questlog/core/services/write-request.service.js";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { connectedClient, createMockFetch, db } from "../test-helpers.js";

describe("archive_entity + confirm_archive_entity tools", () => {
	// Same nested-transaction concern as update_entity/confirm_update_entity
	// above — confirm_archive_entity opens its own db.transaction().
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

	it("previews the proposed archive without persisting anything", async () => {
		const entity = await entityService.create(db, {
			campaignId,
			name: "Mira Duskwood",
			type: "npc",
		});

		const client = await connectedClient(createMockFetch(basisVector(0)));
		const result = await client.callTool({
			name: "archive_entity",
			arguments: { campaignId, entityId: entity.id },
		});

		expect(result.isError).toBeFalsy();
		const content = result.content as Array<{ type: string; text: string }>;
		const payload = JSON.parse(content[0]?.text ?? "{}");

		expect(payload.token).toBeDefined();
		expect(payload.preview.before).toMatchObject({ status: "active" });
		expect(payload.preview.after).toMatchObject({ status: "archived" });

		const [unchanged] = await db
			.select()
			.from(entities)
			.where(eq(entities.id, entity.id));
		expect(unchanged?.status).toBe("active");
	});

	it("sets the entity's status to archived on confirm", async () => {
		const entity = await entityService.create(db, {
			campaignId,
			name: "Mira Duskwood",
			type: "npc",
		});

		const client = await connectedClient(createMockFetch(basisVector(0)));
		const previewResult = await client.callTool({
			name: "archive_entity",
			arguments: { campaignId, entityId: entity.id },
		});
		const previewContent = previewResult.content as Array<{
			type: string;
			text: string;
		}>;
		const { token } = JSON.parse(previewContent[0]?.text ?? "{}");

		const confirmResult = await client.callTool({
			name: "confirm_archive_entity",
			arguments: { token },
		});

		expect(confirmResult.isError).toBeFalsy();
		const confirmContent = confirmResult.content as Array<{
			type: string;
			text: string;
		}>;
		const confirmed = JSON.parse(confirmContent[0]?.text ?? "{}");
		expect(confirmed.status).toBe("archived");

		const [updated] = await db
			.select()
			.from(entities)
			.where(eq(entities.id, entity.id));
		expect(updated?.status).toBe("archived");
	});

	it("rejects a preview for a bogus entityId before a write request is even created", async () => {
		const client = await connectedClient(createMockFetch(basisVector(0)));
		const unknownEntityId = "00000000-0000-0000-0000-000000000000";

		const result = await client.callTool({
			name: "archive_entity",
			arguments: { campaignId, entityId: unknownEntityId },
		});

		expect(result.isError).toBe(true);
		const content = result.content as Array<{ type: string; text: string }>;
		const payload = JSON.parse(content[0]?.text ?? "{}");
		expect(payload.error.code).toBe("NOT_FOUND");
	});

	it("returns a well-formed not-found error from confirm_archive_entity for a bogus entityId", async () => {
		const unknownEntityId = "00000000-0000-0000-0000-000000000000";
		const { token } = await writeRequestService.createPreview(db, {
			campaignId,
			toolName: "archive_entity",
			payload: { campaignId, entityId: unknownEntityId },
		});

		const client = await connectedClient(createMockFetch(basisVector(0)));
		const result = await client.callTool({
			name: "confirm_archive_entity",
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
			name: "archive_entity",
			arguments: { campaignId, entityId: entity.id },
		});
		const previewContent = previewResult.content as Array<{
			type: string;
			text: string;
		}>;
		const { token } = JSON.parse(previewContent[0]?.text ?? "{}");

		await client.callTool({
			name: "confirm_archive_entity",
			arguments: { token },
		});
		const secondResult = await client.callTool({
			name: "confirm_archive_entity",
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
		expect(updated?.status).toBe("archived");
	});
});
