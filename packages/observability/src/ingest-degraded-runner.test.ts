import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { testDbUrl } from "@questlog/core/db/test-db-url.js";
import type { RunCaptureResult } from "@questlog/core/usage-capture/runner-adapter.js";
import { buildUsageArtifactFromRunCaptureResult } from "@questlog/core/usage-capture/runner-adapter.js";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres, { type Sql } from "postgres";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { ingestUsageArtifact } from "./cli.js";
import { truncateAllTables } from "./db/global-setup.js";
import { ticketComments, ticketReports, ticketRuns } from "./schema/tables.js";

// testDbUrl(), not process.env.DATABASE_URL directly — see ingest-db.test.ts's
// own note (Docs/IMPLEMENTATION_NOTES.md § T-052).
const client: Sql = postgres(testDbUrl("questlog_test_observability"), {
	max: 1,
});
// Full schema, not just the two tables this suite exercises — `Database`
// (this file's `db` is later passed where that type is expected) is typed
// from the package's complete schema (`db/index.ts`'s `import * as schema`),
// so a narrower literal here fails to typecheck as of T-059's `ticketComments`
// addition even though this suite never touches that table.
const db = drizzle(client, {
	schema: { ticketRuns, ticketReports, ticketComments },
});

beforeEach(async () => {
	await truncateAllTables(client);
});

afterAll(async () => {
	await client.end();
});

describe("ingestUsageArtifact — degraded (transcript-less) runner (T-109)", () => {
	let tmpFile: string | undefined;

	afterEach(() => {
		if (tmpFile) {
			rmSync(tmpFile, { recursive: true, force: true });
			tmpFile = undefined;
		}
	});

	it("round-trips a degraded RunCaptureResult through buildUsageArtifactFromRunCaptureResult + ingestUsageArtifact without requiring any Claude-Code-only field to be non-null", async () => {
		// Fixture-driven stand-in for a real Devin/ACU adapter — no live API
		// call, just proving the interface accommodates a runner with no
		// transcript access (T-109's ticket: a real adapter is out of scope).
		const degradedResult: RunCaptureResult = {
			runner: "devin-stub",
			ticketId: "T-998",
			sessionId: "devin-session-1",
			durationMs: 45_000,
			turnCount: 0,
			turnsToGreen: null,
			humanMessageCount: null,
			tokenTotals: null,
			reviewerSubagentTokenTotals: null,
			vendorCost: { amount: 3.5, unit: "ACU" },
		};
		const artifact = buildUsageArtifactFromRunCaptureResult(degradedResult);

		const dir = mkdtempSync(join(tmpdir(), "questlog-degraded-runner-"));
		tmpFile = dir;
		const usageJsonPath = join(dir, "T-998.usage.json");
		writeFileSync(usageJsonPath, JSON.stringify(artifact, null, 2));

		await expect(ingestUsageArtifact(db, usageJsonPath)).resolves.not.toThrow();

		const [inserted] = await db
			.select()
			.from(ticketRuns)
			.where(eq(ticketRuns.ticketId, "T-998"));

		expect(inserted).toBeDefined();
		expect(inserted?.runner).toBe("devin-stub");
		expect(inserted?.turnsToGreen).toBeNull();
		expect(inserted?.inputTokens).toBe(0);
		expect(inserted?.outputTokens).toBe(0);
	});
});
