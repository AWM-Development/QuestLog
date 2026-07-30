import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { testDbUrl } from "@questlog/core/db/test-db-url.js";
import type { UsageArtifact } from "@questlog/core/observability/artifact.js";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres, { type Sql } from "postgres";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { truncateAllTables } from "./db/global-setup.js";
import {
	mapReportToTicketReport,
	mapUsageArtifactToTicketRun,
	upsertTicketReport,
	upsertTicketRun,
} from "./ingest.js";
import { ticketReports, ticketRuns } from "./schema/tables.js";

const fixturesDir = fileURLToPath(new URL("./__fixtures__", import.meta.url));

function readFixture(name: string): string {
	return readFileSync(`${fixturesDir}/${name}`, "utf-8");
}

// testDbUrl(), not process.env.DATABASE_URL directly — resolved fresh at
// this module's own top-level evaluation, same as global-setup.ts's own
// resolveLocalTestDbUrl() call, rather than racing Vitest's test.env
// application to process.env (Docs/IMPLEMENTATION_NOTES.md § T-052).
const client: Sql = postgres(testDbUrl("questlog_test_observability"), {
	max: 1,
});
const db = drizzle(client, { schema: { ticketRuns, ticketReports } });

beforeEach(async () => {
	await truncateAllTables(client);
});

afterAll(async () => {
	await client.end();
});

describe("upsertTicketRun idempotency", () => {
	it("inserts once and updates (not duplicates) on a second run against the same ticket_id", async () => {
		const artifact = JSON.parse(
			readFixture("T-999.usage.json"),
		) as UsageArtifact;
		const row = mapUsageArtifactToTicketRun(artifact);

		await upsertTicketRun(db, row);
		await upsertTicketRun(db, { ...row, turnCount: 999 });

		const matching = (await db.select().from(ticketRuns)).filter(
			(r) => r.ticketId === "T-999",
		);
		expect(matching).toHaveLength(1);
		expect(matching[0]?.turnCount).toBe(999);
	});

	it("inserts an empty-run (ticket_id: null, empty_run: true) fixture without violating any constraint", async () => {
		const artifact = JSON.parse(
			readFixture("empty-run-fixture.usage.json"),
		) as UsageArtifact;
		const row = mapUsageArtifactToTicketRun(artifact);

		await expect(upsertTicketRun(db, row)).resolves.not.toThrow();

		const all = await db.select().from(ticketRuns);
		expect(all).toHaveLength(1);
		expect(all[0]?.ticketId).toBeNull();
		expect(all[0]?.emptyRun).toBe(true);
	});

	it("running the empty-run insert twice produces two independent rows, not an upsert", async () => {
		const artifact = JSON.parse(
			readFixture("empty-run-fixture.usage.json"),
		) as UsageArtifact;
		const row = mapUsageArtifactToTicketRun(artifact);

		await upsertTicketRun(db, row);
		await upsertTicketRun(db, row);

		const all = await db.select().from(ticketRuns);
		expect(all).toHaveLength(2);
	});
});

describe("upsertTicketReport idempotency", () => {
	it("inserts once and updates (not duplicates) on a second run against the same ticket_id", async () => {
		const content = readFixture("T-999-fixture-report.md");
		const row = mapReportToTicketReport({
			ticketId: "T-999",
			reportType: "shipped",
			content,
		});

		await upsertTicketReport(db, row);
		await upsertTicketReport(db, { ...row, remediationPassRequired: false });

		const matching = (await db.select().from(ticketReports)).filter(
			(r) => r.ticketId === "T-999",
		);
		expect(matching).toHaveLength(1);
		expect(matching[0]?.remediationPassRequired).toBe(false);
	});
});
