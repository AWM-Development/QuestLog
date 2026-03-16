import { sql } from "drizzle-orm";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "../db/test-helpers.js";
import { NotFoundError } from "../lib/errors.js";
import { campaignService } from "./campaign.service.js";

const { db, close } = createTestDb();

afterAll(async () => {
	await close();
});

describe("campaignService", () => {
	beforeEach(async () => {
		await db.execute(sql`BEGIN`);
	});

	afterEach(async () => {
		await db.execute(sql`ROLLBACK`);
	});

	describe("create", () => {
		it("creates a campaign with required fields", async () => {
			const result = await campaignService.create(db, {
				name: "Lost Mines",
				theme: "fantasy",
			});

			expect(result.id).toBeDefined();
			expect(result.name).toBe("Lost Mines");
			expect(result.theme).toBe("fantasy");
			expect(result.status).toBe("active");
			expect(result.description).toBeNull();
			expect(result.gameSystem).toBeNull();
			expect(result.createdAt).toBeInstanceOf(Date);
			expect(result.updatedAt).toBeInstanceOf(Date);
		});

		it("creates a campaign with all optional fields", async () => {
			const result = await campaignService.create(db, {
				name: "Curse of Strahd",
				theme: "horror",
				description: "Gothic horror in Barovia",
				gameSystem: "D&D 5e",
			});

			expect(result.description).toBe("Gothic horror in Barovia");
			expect(result.gameSystem).toBe("D&D 5e");
		});
	});

	describe("getById", () => {
		it("returns the campaign when it exists", async () => {
			const created = await campaignService.create(db, {
				name: "Test Campaign",
				theme: "fantasy",
			});

			const found = await campaignService.getById(db, created.id);
			expect(found.id).toBe(created.id);
			expect(found.name).toBe("Test Campaign");
		});

		it("throws NotFoundError for a non-existent id", async () => {
			const fakeId = "00000000-0000-0000-0000-000000000000";
			await expect(campaignService.getById(db, fakeId)).rejects.toThrow(
				NotFoundError,
			);
		});
	});

	describe("list", () => {
		it("returns all active campaigns ordered by most recently updated", async () => {
			const a = await campaignService.create(db, {
				name: "Campaign A",
				theme: "fantasy",
			});
			await campaignService.create(db, { name: "Campaign B", theme: "sci-fi" });

			await campaignService.update(db, {
				id: a.id,
				name: "Campaign A Updated",
			});

			const results = await campaignService.list(db);
			expect(results.length).toBeGreaterThanOrEqual(2);
			expect(results[0]?.name).toBe("Campaign A Updated");
			expect(results[1]?.name).toBe("Campaign B");
		});

		it("does not return archived campaigns", async () => {
			const campaign = await campaignService.create(db, {
				name: "To Archive",
				theme: "fantasy",
			});
			await campaignService.archive(db, campaign.id);

			const results = await campaignService.list(db);
			expect(results.find((c) => c.id === campaign.id)).toBeUndefined();
		});
	});

	describe("update", () => {
		it("updates specified fields only", async () => {
			const created = await campaignService.create(db, {
				name: "Original",
				theme: "fantasy",
				description: "Original desc",
			});

			const updated = await campaignService.update(db, {
				id: created.id,
				name: "Updated Name",
			});

			expect(updated.name).toBe("Updated Name");
			expect(updated.description).toBe("Original desc");
			expect(updated.theme).toBe("fantasy");
		});

		it("allows setting nullable fields to null", async () => {
			const created = await campaignService.create(db, {
				name: "With Desc",
				theme: "fantasy",
				description: "Has a description",
			});

			const updated = await campaignService.update(db, {
				id: created.id,
				description: null,
			});

			expect(updated.description).toBeNull();
		});

		it("throws NotFoundError when campaign does not exist", async () => {
			const fakeId = "00000000-0000-0000-0000-000000000000";
			await expect(
				campaignService.update(db, { id: fakeId, name: "Nope" }),
			).rejects.toThrow(NotFoundError);
		});
	});

	describe("archive", () => {
		it("sets status to archived", async () => {
			const created = await campaignService.create(db, {
				name: "Active Campaign",
				theme: "fantasy",
			});

			const archived = await campaignService.archive(db, created.id);
			expect(archived.status).toBe("archived");
		});

		it("throws NotFoundError when campaign does not exist", async () => {
			const fakeId = "00000000-0000-0000-0000-000000000000";
			await expect(campaignService.archive(db, fakeId)).rejects.toThrow(
				NotFoundError,
			);
		});
	});
});
