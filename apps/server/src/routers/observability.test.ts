import { createTestDb } from "@questlog/core/db/test-helpers.js";
import { NotFoundError } from "@questlog/core/lib/errors.js";
import { createMemoryStorage } from "@questlog/core/services/storage.service.js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// Mocked, not a real DB — this router's own connection
// (../observability-db.js) shares a physical local Postgres database with
// packages/observability's own test suite (questlog_test_observability),
// and turbo runs every package's `test` task with no ordering between them
// (turbo.json's `test` task has no `dependsOn`), so a real-DB router test
// here races that suite's own truncate/insert calls (confirmed live: this
// exact test failed intermittently under `scripts/run-tests-quiet.sh`'s
// full run, passed every time in isolation). The router is deliberately
// thin (no business logic — see backend.md), so mocking the service layer
// here only exercises wiring: input validation, that the right service
// function is called with the parsed input, and that its return value (or
// thrown `NotFoundError`, mapped to tRPC's NOT_FOUND) passes through
// untouched. The query logic itself is covered against a real DB in
// packages/observability/src/services/query.service.test.ts.
vi.mock("@questlog/observability/services/query.service.js", () => ({
	observabilityQueryService: {
		getTicketRun: vi.fn(),
		listTrends: vi.fn(),
		listReports: vi.fn(),
	},
}));

const { observabilityQueryService } = await import(
	"@questlog/observability/services/query.service.js"
);
const { buildApp } = await import("../server.js");

const { db, close } = createTestDb();
const storage = createMemoryStorage();
const app = buildApp({ db, storage });

beforeAll(async () => {
	await app.ready();
});

afterAll(async () => {
	await app.close();
	await close();
});

async function trpcQuery(path: string, input: unknown) {
	return app.inject({
		method: "GET",
		url: `/trpc/${path}?input=${encodeURIComponent(JSON.stringify({ json: input }))}`,
	});
}

describe("observability router", () => {
	describe("observability.getByTicketId", () => {
		it("passes the parsed ticketId to the service and returns its result", async () => {
			const fixture = {
				run: { id: "r1", ticketId: "T-210" },
				reports: [{ id: "rep1", content: "looks good" }],
			};
			vi.mocked(observabilityQueryService.getTicketRun).mockResolvedValue(
				// biome-ignore lint/suspicious/noExplicitAny: fixture shape, not the real Drizzle row type
				fixture as any,
			);

			const response = await trpcQuery("observability.getByTicketId", {
				ticketId: "T-210",
			});

			expect(response.statusCode).toBe(200);
			expect(observabilityQueryService.getTicketRun).toHaveBeenCalledWith(
				expect.anything(),
				"T-210",
			);
			expect(response.json().result.data.json).toEqual(fixture);
		});

		it("returns 404 (the defined not-found shape) when the service finds nothing", async () => {
			vi.mocked(observabilityQueryService.getTicketRun).mockRejectedValue(
				new NotFoundError("TicketRun", "T-does-not-exist"),
			);

			const response = await trpcQuery("observability.getByTicketId", {
				ticketId: "T-does-not-exist",
			});

			expect(response.statusCode).toBe(404);
		});

		it("rejects an empty ticketId before reaching the service", async () => {
			const response = await trpcQuery("observability.getByTicketId", {
				ticketId: "",
			});

			expect(response.statusCode).toBe(400);
		});
	});

	describe("observability.trends", () => {
		it("defaults includeEmptyRuns to false and forwards filters to the service", async () => {
			vi.mocked(observabilityQueryService.listTrends).mockResolvedValue([]);

			await trpcQuery("observability.trends", {});

			expect(observabilityQueryService.listTrends).toHaveBeenCalledWith(
				expect.anything(),
				expect.objectContaining({ includeEmptyRuns: false }),
			);
		});
	});

	describe("observability.feed", () => {
		it("defaults pagination and returns the service's result", async () => {
			const fixture = [{ id: "rep1", content: "report" }];
			vi.mocked(observabilityQueryService.listReports).mockResolvedValue(
				// biome-ignore lint/suspicious/noExplicitAny: fixture shape, not the real Drizzle row type
				fixture as any,
			);

			const response = await trpcQuery("observability.feed", {});

			expect(observabilityQueryService.listReports).toHaveBeenCalledWith(
				expect.anything(),
				expect.objectContaining({ limit: 20, offset: 0 }),
			);
			expect(response.json().result.data.json).toEqual(fixture);
		});
	});
});
