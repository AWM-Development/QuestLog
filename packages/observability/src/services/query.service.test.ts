import { testDbUrl } from "@questlog/core/db/test-db-url.js";
import { NotFoundError } from "@questlog/core/lib/errors.js";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres, { type Sql } from "postgres";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { truncateAllTables } from "../db/global-setup.js";
import { ticketComments, ticketReports, ticketRuns } from "../schema/tables.js";
import { observabilityQueryService } from "./query.service.js";

const client: Sql = postgres(testDbUrl("questlog_test_observability"), {
	max: 1,
});
// Full schema, not just the two tables this suite exercises — see
// ingest-db.test.ts's identical note.
const db = drizzle(client, {
	schema: { ticketRuns, ticketReports, ticketComments },
});

beforeEach(async () => {
	await truncateAllTables(client);
});

afterAll(async () => {
	await client.end();
});

const baseRun = {
	runner: "claude-code",
	sessionId: "sess-1",
	inputTokens: 100,
	outputTokens: 50,
	cacheCreationInputTokens: 0,
	cacheReadInputTokens: 0,
	durationMs: 1000,
	turnCount: 5,
	turnsToGreen: 2,
	appliesRate: "standard" as const,
	theoreticalCostIntroUsd: 1,
	theoreticalCostStandardUsd: 1,
	totalSystemCostIntroUsd: 1,
	totalSystemCostStandardUsd: 1,
};

describe("observabilityQueryService.getTicketRun", () => {
	it("returns the ticket_runs row joined with its ticket_reports rows for a seeded ticket_id", async () => {
		await db.insert(ticketRuns).values({
			...baseRun,
			ticketId: "T-200",
			emptyRun: false,
		});
		await db.insert(ticketReports).values({
			ticketId: "T-200",
			reportType: "shipped",
			reviewerVerdict: "PASS",
			content: "shipped fine",
		});

		const result = await observabilityQueryService.getTicketRun(db, "T-200");

		expect(result).not.toBeNull();
		expect(result?.run.ticketId).toBe("T-200");
		expect(result?.reports).toHaveLength(1);
		expect(result?.reports[0]?.content).toBe("shipped fine");
	});

	it("throws NotFoundError for an unseeded ticket_id", async () => {
		await expect(
			observabilityQueryService.getTicketRun(db, "T-999-nope"),
		).rejects.toThrow(NotFoundError);
	});
});

describe("observabilityQueryService.listTrends", () => {
	// No manually_inspected filter/test — see IMPLEMENTATION_NOTES.md § T-054.
	it("excludes empty_run rows by default, includes them when the filter is explicitly set", async () => {
		await db.insert(ticketRuns).values([
			{ ...baseRun, ticketId: "T-201", emptyRun: false },
			{ ...baseRun, ticketId: "T-202", emptyRun: true, sessionId: "sess-2" },
		]);

		const defaultResult = await observabilityQueryService.listTrends(db, {});
		expect(defaultResult.every((r) => r.emptyRun === false)).toBe(true);

		const withEmptyRuns = await observabilityQueryService.listTrends(db, {
			includeEmptyRuns: true,
		});
		expect(withEmptyRuns.some((r) => r.emptyRun === true)).toBe(true);
	});

	it("filters by an optional date range", async () => {
		await db.insert(ticketRuns).values({
			...baseRun,
			ticketId: "T-203",
			emptyRun: false,
		});
		const future = new Date(Date.now() + 24 * 60 * 60 * 1000);

		const inRange = await observabilityQueryService.listTrends(db, {
			from: new Date(Date.now() - 24 * 60 * 60 * 1000),
			to: future,
		});
		expect(inRange.some((r) => r.ticketId === "T-203")).toBe(true);

		const outOfRange = await observabilityQueryService.listTrends(db, {
			from: future,
		});
		expect(outOfRange.some((r) => r.ticketId === "T-203")).toBe(false);
	});
});

describe("observabilityQueryService.listReports", () => {
	it("returns rows newest-first and respects pagination limits", async () => {
		for (let i = 0; i < 3; i++) {
			await db.insert(ticketReports).values({
				ticketId: `T-30${i}`,
				reportType: "shipped",
				content: `report ${i}`,
			});
		}

		const page = await observabilityQueryService.listReports(db, {
			limit: 2,
			offset: 0,
		});
		expect(page).toHaveLength(2);
		expect(new Date(page[0]?.createdAt ?? 0).getTime()).toBeGreaterThanOrEqual(
			new Date(page[1]?.createdAt ?? 0).getTime(),
		);

		const secondPage = await observabilityQueryService.listReports(db, {
			limit: 2,
			offset: 2,
		});
		expect(secondPage).toHaveLength(1);
	});
});
