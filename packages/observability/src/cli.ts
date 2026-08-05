import { readFileSync } from "node:fs";
import type { UsageArtifact } from "@questlog/core/observability/artifact.js";
import type { Database } from "./db/index.js";
import {
	type ReportType,
	mapReportToTicketReport,
	mapUsageArtifactToTicketRun,
	upsertTicketReport,
	upsertTicketRun,
} from "./ingest.js";

function inferReportType(content: string): ReportType {
	if (/^\*\*Outcome:\*\*\s*blocked/m.test(content)) return "blocked";
	if (/^\*\*Outcome:\*\*\s*wont_fix/m.test(content)) return "wont_fix";
	return "shipped";
}

/**
 * Reads a `*.usage.json` file (and, if given, its report markdown) and
 * upserts both into the observability store. Idempotent on ticket id — safe
 * to re-run against the same pair. `db` is injected (not imported from
 * ./db/index.js directly) so this stays testable against a test database
 * without opening the real OBSERVABILITY_DATABASE_URL connection — same
 * thin-shell/tested-service split as packages/core/src/observability/capture-usage.ts.
 */
export async function ingestUsageArtifact(
	db: Database,
	usageJsonPath: string,
	reportPath?: string,
) {
	const artifact = JSON.parse(
		readFileSync(usageJsonPath, "utf-8"),
	) as UsageArtifact;

	await upsertTicketRun(db, mapUsageArtifactToTicketRun(artifact));

	if (artifact.ticket_id === null || !reportPath) return;

	const content = readFileSync(reportPath, "utf-8");
	await upsertTicketReport(
		db,
		mapReportToTicketReport({
			ticketId: artifact.ticket_id,
			reportType: inferReportType(content),
			content,
		}),
	);
}

// Graceful-degradation rationale: Docs/IMPLEMENTATION_NOTES.md § T-095.
function warnIngestionSkipped(err: unknown): void {
	const message = err instanceof Error ? err.message : String(err);
	console.warn(`Observability ingestion skipped — ${message}`);
}

/**
 * The guarded entry block's logic, factored out so it's testable without
 * running this file as a script (`.claude/rules/scripts.md`'s dual-mode
 * shape). `loadDb` is injected so the graceful-degradation path above can
 * be exercised without a real env var or a real unreachable connection.
 */
export async function runIngestCli(
	argv: string[],
	loadDb: () => Promise<{ db: Database }> = () => import("./db/index.js"),
): Promise<void> {
	// Defense in depth against pnpm's `run ... --` mis-forwarding: Docs/IMPLEMENTATION_NOTES.md § T-095.
	const [usageJsonPath, reportPath] = argv[0] === "--" ? argv.slice(1) : argv;
	if (!usageJsonPath) {
		console.error(
			"Usage: tsx src/cli.ts <path/to/T-###.usage.json> [path/to/T-###-slug.md]",
		);
		process.exitCode = 1;
		return;
	}

	let db: Database;
	try {
		({ db } = await loadDb());
	} catch (err) {
		warnIngestionSkipped(err);
		return;
	}

	try {
		await ingestUsageArtifact(db, usageJsonPath, reportPath);
		console.log(`Ingested ${usageJsonPath}`);
	} catch (err) {
		warnIngestionSkipped(err);
	} finally {
		await db.$client.end().catch(() => {});
	}
}

if (import.meta.url === `file://${process.argv[1]}`) {
	runIngestCli(process.argv.slice(2)).catch((err) => {
		console.error("Unexpected ingestion CLI error:", err);
		process.exitCode = 1;
	});
}
