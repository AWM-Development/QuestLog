import { testDbUrl } from "@questlog/core/db/test-db-url.js";
import { createTestDb } from "@questlog/core/db/test-helpers.js";
import { createMemoryStorage } from "@questlog/core/services/storage.service.js";
import { truncateAllTables } from "@questlog/observability/db/global-setup.js";
import {
	ticketComments,
	ticketReports,
	ticketRuns,
} from "@questlog/observability/schema/tables.js";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres, { type Sql } from "postgres";
import {
	afterAll,
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
} from "vitest";
import { buildApp } from "../server.js";

const { db, close } = createTestDb();
const storage = createMemoryStorage();

const observabilityClient: Sql = postgres(
	testDbUrl("questlog_test_observability"),
	{ max: 1 },
);
const observabilityDb = drizzle(observabilityClient, {
	schema: { ticketComments, ticketReports, ticketRuns },
});

const app = buildApp({ db, storage, observabilityDb });

beforeAll(async () => {
	await app.ready();
});

afterAll(async () => {
	await app.close();
	await close();
	await observabilityClient.end();
});

beforeEach(async () => {
	await truncateAllTables(observabilityClient);
});

afterEach(async () => {
	await truncateAllTables(observabilityClient);
});

describe("comment router", () => {
	describe("comment.list", () => {
		it("returns an empty array, not an error, for a ticketId with no comments", async () => {
			const response = await app.inject({
				method: "GET",
				url: `/trpc/comment.list?input=${encodeURIComponent(JSON.stringify({ json: { ticketId: "T-999-no-comments" } }))}`,
			});

			expect(response.statusCode).toBe(200);
			expect(response.json().result.data.json).toEqual([]);
		});

		it("returns comments for the ticket, oldest first", async () => {
			await app.inject({
				method: "POST",
				url: "/trpc/comment.add",
				headers: { "content-type": "application/json" },
				payload: { json: { ticketId: "T-999", body: "first" } },
			});
			await app.inject({
				method: "POST",
				url: "/trpc/comment.add",
				headers: { "content-type": "application/json" },
				payload: { json: { ticketId: "T-999", body: "second" } },
			});

			const response = await app.inject({
				method: "GET",
				url: `/trpc/comment.list?input=${encodeURIComponent(JSON.stringify({ json: { ticketId: "T-999" } }))}`,
			});

			expect(response.statusCode).toBe(200);
			const data = response.json().result.data.json;
			expect(data.map((c: { body: string }) => c.body)).toEqual([
				"first",
				"second",
			]);
		});
	});

	describe("comment.add", () => {
		it("inserts a comment with author 'alex', correct body, and a server-set createdAt", async () => {
			const response = await app.inject({
				method: "POST",
				url: "/trpc/comment.add",
				headers: { "content-type": "application/json" },
				payload: { json: { ticketId: "T-998", body: "Looks good." } },
			});

			expect(response.statusCode).toBe(200);
			const data = response.json().result.data.json;
			expect(data.ticketId).toBe("T-998");
			expect(data.author).toBe("alex");
			expect(data.body).toBe("Looks good.");
			expect(data.createdAt).toBeTruthy();

			const listResponse = await app.inject({
				method: "GET",
				url: `/trpc/comment.list?input=${encodeURIComponent(JSON.stringify({ json: { ticketId: "T-998" } }))}`,
			});
			expect(listResponse.json().result.data.json).toHaveLength(1);
		});

		it("rejects an empty body", async () => {
			const response = await app.inject({
				method: "POST",
				url: "/trpc/comment.add",
				headers: { "content-type": "application/json" },
				payload: { json: { ticketId: "T-998", body: "" } },
			});
			expect(response.statusCode).toBe(400);
		});
	});
});
