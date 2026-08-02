import { sql } from "drizzle-orm";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { chunks } from "../db/schema/index.js";
import { createTestDb } from "../db/test-helpers.js";
import { NotFoundError } from "../lib/errors.js";
import { campaignService } from "./campaign.service.js";
import { sourceService } from "./source.service.js";

const { db, close } = createTestDb();

afterAll(async () => {
	await close();
});

describe("sourceService", () => {
	let campaignId: string;

	beforeEach(async () => {
		await db.execute(sql`BEGIN`);
		const campaign = await campaignService.create(db, {
			name: "Test Campaign",
			theme: "fantasy",
		});
		campaignId = campaign.id;
	});

	afterEach(async () => {
		await db.execute(sql`ROLLBACK`);
	});

	describe("create", () => {
		it("creates a source with required fields", async () => {
			const result = await sourceService.create(db, {
				campaignId,
				name: "worldbuilding.pdf",
				type: "pdf",
				sizeBytes: 1024,
				hash: "abc123",
			});

			expect(result.id).toBeDefined();
			expect(result.campaignId).toBe(campaignId);
			expect(result.name).toBe("worldbuilding.pdf");
			expect(result.type).toBe("pdf");
			expect(result.sizeBytes).toBe(1024);
			expect(result.hash).toBe("abc123");
			expect(result.status).toBe("pending");
			expect(result.createdAt).toBeInstanceOf(Date);
		});

		it("creates a source with null hash (e.g. pasted text)", async () => {
			const result = await sourceService.create(db, {
				campaignId,
				name: "notes",
				type: "paste",
				sizeBytes: null,
				hash: null,
			});

			expect(result.hash).toBeNull();
			expect(result.sizeBytes).toBeNull();
		});
	});

	describe("createFromText", () => {
		it("creates a source from pasted text with content in metadata", async () => {
			const result = await sourceService.createFromText(db, {
				campaignId,
				name: "NPC backstories",
				content: "Aldric is a grizzled veteran...",
			});

			expect(result.id).toBeDefined();
			expect(result.name).toBe("NPC backstories");
			expect(result.type).toBe("paste");
			expect(result.status).toBe("pending");
			expect(result.metadata?.content).toBe("Aldric is a grizzled veteran...");
			expect(result.hash).toBeNull();
		});
	});

	describe("appendContent", () => {
		it("concatenates onto the existing metadata.content of a pending source", async () => {
			const created = await sourceService.createFromText(db, {
				campaignId,
				name: "Chunked Primer",
				content: "Part one. ",
			});

			const updated = await sourceService.appendContent(
				db,
				created.id,
				"Part two.",
			);

			expect(updated.metadata?.content).toBe("Part one. Part two.");
			expect(updated.status).toBe("pending");
		});

		it("throws when the source is not pending", async () => {
			const created = await sourceService.createFromText(db, {
				campaignId,
				name: "Already Processing",
				content: "Some content.",
			});
			await sourceService.updateStatus(db, created.id, "done");

			await expect(
				sourceService.appendContent(db, created.id, "More content."),
			).rejects.toThrow();
		});
	});

	describe("listByCampaign", () => {
		it("returns sources for the campaign ordered by createdAt desc", async () => {
			// Use explicit timestamps because Postgres pins NOW() to the transaction
			// start time — two inserts in the same transaction get identical timestamps.
			await db.execute(
				sql`INSERT INTO sources (id, campaign_id, name, type, status, created_at, updated_at)
            VALUES (gen_random_uuid(), ${campaignId}, 'first.txt', 'text', 'pending',
                    NOW() - INTERVAL '2 seconds', NOW() - INTERVAL '2 seconds')`,
			);
			await db.execute(
				sql`INSERT INTO sources (id, campaign_id, name, type, status, created_at, updated_at)
            VALUES (gen_random_uuid(), ${campaignId}, 'second.txt', 'text', 'pending',
                    NOW(), NOW())`,
			);

			const results = await sourceService.listByCampaign(db, campaignId);

			expect(results).toHaveLength(2);
			// Most recently created should come first
			expect(results[0]?.name).toBe("second.txt");
			expect(results[1]?.name).toBe("first.txt");
		});

		it("only returns sources for the requested campaign", async () => {
			const otherCampaign = await campaignService.create(db, {
				name: "Other Campaign",
				theme: "sci-fi",
			});
			await sourceService.create(db, {
				campaignId,
				name: "mine.txt",
				type: "text",
				sizeBytes: 10,
				hash: "h1",
			});
			await sourceService.create(db, {
				campaignId: otherCampaign.id,
				name: "theirs.txt",
				type: "text",
				sizeBytes: 10,
				hash: "h2",
			});

			const results = await sourceService.listByCampaign(db, campaignId);

			expect(results).toHaveLength(1);
			expect(results[0]?.name).toBe("mine.txt");
		});
	});

	describe("getByIdUnscoped", () => {
		it("returns the source when it exists", async () => {
			const created = await sourceService.create(db, {
				campaignId,
				name: "test.md",
				type: "markdown",
				sizeBytes: 500,
				hash: "deadbeef",
			});

			const found = await sourceService.getByIdUnscoped(db, created.id);
			expect(found.id).toBe(created.id);
			expect(found.name).toBe("test.md");
		});

		it("throws NotFoundError for non-existent id", async () => {
			const fakeId = "00000000-0000-0000-0000-000000000000";
			await expect(sourceService.getByIdUnscoped(db, fakeId)).rejects.toThrow(
				NotFoundError,
			);
		});
	});

	describe("getByIdForCampaign", () => {
		it("returns the source when it belongs to the given campaign", async () => {
			const created = await sourceService.create(db, {
				campaignId,
				name: "test.md",
				type: "markdown",
				sizeBytes: 500,
				hash: "deadbeef",
			});

			const found = await sourceService.getByIdForCampaign(
				db,
				campaignId,
				created.id,
			);
			expect(found.id).toBe(created.id);
			expect(found.name).toBe("test.md");
		});

		it("throws NotFoundError for a source owned by a different campaign", async () => {
			const otherCampaign = await campaignService.create(db, {
				name: "Other Campaign",
				theme: "sci-fi",
			});
			const created = await sourceService.create(db, {
				campaignId: otherCampaign.id,
				name: "theirs.txt",
				type: "text",
				sizeBytes: 10,
				hash: "h1",
			});

			await expect(
				sourceService.getByIdForCampaign(db, campaignId, created.id),
			).rejects.toThrow(NotFoundError);
		});

		it("throws NotFoundError for non-existent id", async () => {
			const fakeId = "00000000-0000-0000-0000-000000000000";
			await expect(
				sourceService.getByIdForCampaign(db, campaignId, fakeId),
			).rejects.toThrow(NotFoundError);
		});
	});

	describe("updateStatus", () => {
		it("updates the status and returns the updated source", async () => {
			const created = await sourceService.create(db, {
				campaignId,
				name: "file.txt",
				type: "text",
				sizeBytes: 100,
				hash: "h",
			});

			const updated = await sourceService.updateStatus(
				db,
				created.id,
				"extracting",
			);
			expect(updated.status).toBe("extracting");

			const done = await sourceService.updateStatus(db, created.id, "done");
			expect(done.status).toBe("done");
		});

		it("throws NotFoundError for non-existent id", async () => {
			const fakeId = "00000000-0000-0000-0000-000000000000";
			await expect(
				sourceService.updateStatus(db, fakeId, "done"),
			).rejects.toThrow(NotFoundError);
		});
	});

	describe("findDuplicate", () => {
		it("returns the existing source when hash matches", async () => {
			const created = await sourceService.create(db, {
				campaignId,
				name: "original.txt",
				type: "text",
				sizeBytes: 100,
				hash: "matching-hash",
			});

			const found = await sourceService.findDuplicate(
				db,
				campaignId,
				"matching-hash",
			);
			expect(found).not.toBeNull();
			expect(found?.id).toBe(created.id);
		});

		it("returns null when no duplicate exists", async () => {
			const found = await sourceService.findDuplicate(
				db,
				campaignId,
				"nonexistent-hash",
			);
			expect(found).toBeNull();
		});

		it("does not return a match from a different campaign", async () => {
			const otherCampaign = await campaignService.create(db, {
				name: "Other Campaign",
				theme: "horror",
			});
			await sourceService.create(db, {
				campaignId: otherCampaign.id,
				name: "file.txt",
				type: "text",
				sizeBytes: 50,
				hash: "shared-hash",
			});

			const found = await sourceService.findDuplicate(
				db,
				campaignId,
				"shared-hash",
			);
			expect(found).toBeNull();
		});
	});

	describe("delete", () => {
		it("removes the source record", async () => {
			const created = await sourceService.create(db, {
				campaignId,
				name: "to-delete.txt",
				type: "text",
				sizeBytes: 10,
				hash: "del-hash",
			});

			await sourceService.delete(db, created.id);

			await expect(
				sourceService.getByIdUnscoped(db, created.id),
			).rejects.toThrow(NotFoundError);
		});

		it("does not throw when deleting a non-existent source (idempotent)", async () => {
			const fakeId = "00000000-0000-0000-0000-000000000000";
			// Should not throw — delete is idempotent
			await expect(sourceService.delete(db, fakeId)).resolves.toBeUndefined();
		});
	});

	describe("replace", () => {
		it("deletes the old source and creates a new one", async () => {
			const old = await sourceService.create(db, {
				campaignId,
				name: "original.pdf",
				type: "pdf",
				sizeBytes: 1000,
				hash: "old-hash",
			});

			const replacement = await sourceService.replace(db, old.id, {
				campaignId,
				name: "original.pdf",
				type: "pdf",
				sizeBytes: 2000,
				hash: "new-hash",
			});

			// Old source should be gone
			await expect(sourceService.getByIdUnscoped(db, old.id)).rejects.toThrow(
				NotFoundError,
			);
			// New source should exist with new hash
			expect(replacement.hash).toBe("new-hash");
			expect(replacement.sizeBytes).toBe(2000);
		});
	});

	describe("listNonSupersededChunkIdsForSource", () => {
		it("returns active chunk ids for the source and excludes superseded ones", async () => {
			const source = await sourceService.create(db, {
				campaignId,
				name: "canon.md",
				type: "paste",
				sizeBytes: null,
				hash: null,
			});

			const [activeA, superseded, activeB] = await db
				.insert(chunks)
				.values([
					{
						campaignId,
						sourceId: source.id,
						content: "Active A",
						status: "active",
					},
					{
						campaignId,
						sourceId: source.id,
						content: "Superseded",
						status: "superseded",
					},
					{
						campaignId,
						sourceId: source.id,
						content: "Active B",
						status: "active",
					},
				])
				.returning();

			const ids = await sourceService.listNonSupersededChunkIdsForSource(
				db,
				campaignId,
				source.id,
			);

			expect(ids).toEqual(expect.arrayContaining([activeA?.id, activeB?.id]));
			expect(ids).not.toContain(superseded?.id);
			expect(ids).toHaveLength(2);
		});

		it("throws NotFoundError when the source belongs to another campaign", async () => {
			const other = await campaignService.create(db, {
				name: "Other",
				theme: "sci-fi",
			});
			const source = await sourceService.create(db, {
				campaignId: other.id,
				name: "theirs.md",
				type: "paste",
				sizeBytes: null,
				hash: null,
			});

			await expect(
				sourceService.listNonSupersededChunkIdsForSource(
					db,
					campaignId,
					source.id,
				),
			).rejects.toThrow(NotFoundError);
		});
	});
});
