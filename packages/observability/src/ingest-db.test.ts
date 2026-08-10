import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { testDbUrl } from "@questlog/core/db/test-db-url.js";
import type { UsageArtifact } from "@questlog/core/usage-capture/artifact.js";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres, { type Sql } from "postgres";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { ingestUsageArtifact } from "./cli.js";
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

describe("upsertTicketRun runner default (T-108)", () => {
	it("defaults runner to 'claude-code' on insert when the row doesn't supply one", async () => {
		const artifact = JSON.parse(
			readFixture("T-999.usage.json"),
		) as UsageArtifact;
		const row = mapUsageArtifactToTicketRun(artifact);
		expect(row.runner).toBeUndefined();

		await upsertTicketRun(db, row);

		const [inserted] = await db
			.select()
			.from(ticketRuns)
			.where(eq(ticketRuns.ticketId, "T-999"));
		expect(inserted?.runner).toBe("claude-code");
	});

	it("defaults runner to 'claude-code' on update when the row doesn't supply one", async () => {
		const artifact = JSON.parse(
			readFixture("T-999.usage.json"),
		) as UsageArtifact;
		const row = mapUsageArtifactToTicketRun(artifact);

		await upsertTicketRun(db, row);
		await upsertTicketRun(db, { ...row, turnCount: 999 });

		const [updated] = await db
			.select()
			.from(ticketRuns)
			.where(eq(ticketRuns.ticketId, "T-999"));
		expect(updated?.runner).toBe("claude-code");
	});

	it("preserves an explicit runner value instead of overwriting it with the default", async () => {
		const artifact = JSON.parse(
			readFixture("T-999.usage.json"),
		) as UsageArtifact;
		const row = { ...mapUsageArtifactToTicketRun(artifact), runner: "devin" };

		await upsertTicketRun(db, row);

		const [inserted] = await db
			.select()
			.from(ticketRuns)
			.where(eq(ticketRuns.ticketId, "T-999"));
		expect(inserted?.runner).toBe("devin");
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

describe("ingestUsageArtifact (CLI)", () => {
	it("run twice against the same fixture usage.json + report pair upserts once on the first run and updates (not duplicates) on the second", async () => {
		const usageJsonPath = `${fixturesDir}/T-999.usage.json`;
		const reportPath = `${fixturesDir}/T-999-fixture-report.md`;

		await ingestUsageArtifact(db, usageJsonPath, reportPath);
		await ingestUsageArtifact(db, usageJsonPath, reportPath);

		const runs = (await db.select().from(ticketRuns)).filter(
			(r) => r.ticketId === "T-999",
		);
		const reports = (await db.select().from(ticketReports)).filter(
			(r) => r.ticketId === "T-999",
		);
		expect(runs).toHaveLength(1);
		expect(reports).toHaveLength(1);
		expect(reports[0]?.reviewerVerdict).toBe("PASS-WITH-NOTES");
	});

	it("an empty-run fixture (no ticket id, no report) upserts only the ticket_runs row", async () => {
		const usageJsonPath = `${fixturesDir}/empty-run-fixture.usage.json`;

		await ingestUsageArtifact(db, usageJsonPath);

		const all = await db.select().from(ticketRuns);
		expect(all).toHaveLength(1);
		expect(all[0]?.ticketId).toBeNull();
		const reports = await db.select().from(ticketReports);
		expect(reports).toHaveLength(0);
	});
});
