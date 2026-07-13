import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {
	afterAll,
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";
import * as schema from "../db/schema/index.js";
import { createTestDb, deleteCampaignTree } from "../db/test-helpers.js";
import { NotFoundError } from "../lib/errors.js";
import { campaignService } from "./campaign.service.js";
import { writeRequestService } from "./write-request.service.js";

const { db, close } = createTestDb();

afterAll(async () => {
	await close();
});

describe("writeRequestService", () => {
	let campaignId: string;

	beforeEach(async () => {
		const campaign = await campaignService.create(db, {
			name: "Test Campaign",
			theme: "fantasy",
		});
		campaignId = campaign.id;
	});

	afterEach(async () => {
		await deleteCampaignTree(db, campaignId);
	});

	async function insertExpiredRequest(payload: unknown = { foo: "bar" }) {
		const rows = await db.execute(sql`
      INSERT INTO write_requests (campaign_id, tool_name, payload, expires_at)
      VALUES (${campaignId}, ${"log_session"}, ${JSON.stringify(payload)}::jsonb, now() - interval '1 minute')
      RETURNING id
    `);
		return (rows[0] as { id: string }).id;
	}

	describe("createPreview + confirm", () => {
		it("calls applyFn exactly once and returns its result, without calling it at createPreview time", async () => {
			const applyFn = vi.fn().mockResolvedValue({ sessionId: "abc123" });

			const preview = await writeRequestService.createPreview(db, {
				campaignId,
				toolName: "log_session",
				payload: { content: "the party arrives in town" },
			});

			expect(preview.token).toBeDefined();
			expect(preview.payload).toEqual({
				content: "the party arrives in town",
			});
			expect(preview.expiresAt).toBeInstanceOf(Date);
			expect(applyFn).not.toHaveBeenCalled();

			const result = await writeRequestService.confirm(
				db,
				preview.token,
				applyFn,
			);

			expect(applyFn).toHaveBeenCalledTimes(1);
			expect(applyFn.mock.calls[0]?.[1]).toEqual({
				content: "the party arrives in town",
			});
			expect(result).toEqual({ sessionId: "abc123" });
		});

		it("throws NotFoundError on a second confirm with the same token, without calling applyFn again", async () => {
			const applyFn = vi.fn().mockResolvedValue({ ok: true });
			const preview = await writeRequestService.createPreview(db, {
				campaignId,
				toolName: "log_session",
				payload: { content: "session content" },
			});

			await writeRequestService.confirm(db, preview.token, applyFn);
			expect(applyFn).toHaveBeenCalledTimes(1);

			await expect(
				writeRequestService.confirm(db, preview.token, applyFn),
			).rejects.toThrow(NotFoundError);
			expect(applyFn).toHaveBeenCalledTimes(1);
		});
	});

	describe("confirm with an unknown token", () => {
		it("throws NotFoundError without calling applyFn", async () => {
			const applyFn = vi.fn();
			const fakeToken = "00000000-0000-0000-0000-000000000000";

			await expect(
				writeRequestService.confirm(db, fakeToken, applyFn),
			).rejects.toThrow(NotFoundError);
			expect(applyFn).not.toHaveBeenCalled();
		});
	});

	describe("expired rows", () => {
		it("getPending treats an expired row as not-found", async () => {
			const id = await insertExpiredRequest();
			await expect(writeRequestService.getPending(db, id)).rejects.toThrow(
				NotFoundError,
			);
		});

		it("confirm treats an expired row as not-found and does not call applyFn", async () => {
			const id = await insertExpiredRequest();
			const applyFn = vi.fn();

			await expect(
				writeRequestService.confirm(db, id, applyFn),
			).rejects.toThrow(NotFoundError);
			expect(applyFn).not.toHaveBeenCalled();
		});
	});

	describe("concurrent confirm calls on the same token", () => {
		it("does not double-apply when two confirm calls race for the same token", async () => {
			// A dedicated multi-connection client is required here: createTestDb()
			// uses { max: 1 }, which serializes all queries onto one physical
			// connection and would mask a real cross-connection race.
			const connectionString =
				process.env.DATABASE_URL ??
				"postgresql://questlog:questlog@localhost:5433/questlog_test";
			const client = postgres(connectionString, { max: 5 });
			const concurrentDb = drizzle(client, { schema });

			try {
				const preview = await writeRequestService.createPreview(concurrentDb, {
					campaignId,
					toolName: "log_session",
					payload: { content: "race" },
				});

				const applyFn = vi.fn().mockImplementation(async () => {
					await new Promise((resolve) => setTimeout(resolve, 50));
					return { ok: true };
				});

				const results = await Promise.allSettled([
					writeRequestService.confirm(concurrentDb, preview.token, applyFn),
					writeRequestService.confirm(concurrentDb, preview.token, applyFn),
				]);

				const fulfilled = results.filter((r) => r.status === "fulfilled");
				const rejected = results.filter((r) => r.status === "rejected");

				expect(fulfilled).toHaveLength(1);
				expect(rejected).toHaveLength(1);
				expect(applyFn).toHaveBeenCalledTimes(1);
			} finally {
				await client.end();
			}
		});
	});

	describe("when applyFn throws", () => {
		it("leaves the row unconfirmed so a retry against the same token is possible", async () => {
			const preview = await writeRequestService.createPreview(db, {
				campaignId,
				toolName: "log_session",
				payload: { content: "will fail" },
			});
			const failingApplyFn = vi.fn().mockRejectedValue(new Error("boom"));

			await expect(
				writeRequestService.confirm(db, preview.token, failingApplyFn),
			).rejects.toThrow("boom");

			const rows = await db.execute(sql`
        SELECT confirmed_at FROM write_requests WHERE id = ${preview.token}
      `);
			expect(
				(rows[0] as { confirmed_at: Date | null }).confirmed_at,
			).toBeNull();

			// retry succeeds against the same token
			const retryApplyFn = vi.fn().mockResolvedValue({ ok: true });
			const result = await writeRequestService.confirm(
				db,
				preview.token,
				retryApplyFn,
			);
			expect(result).toEqual({ ok: true });
		});
	});
});
