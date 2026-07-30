import { readFileSync } from "node:fs";
import type { UsageArtifact } from "@questlog/core/observability/artifact.js";
import { db } from "./db/index.js";
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
 * to re-run against the same pair.
 */
export async function ingestUsageArtifact(
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

if (import.meta.url === `file://${process.argv[1]}`) {
	const [usageJsonPath, reportPath] = process.argv.slice(2);
	if (!usageJsonPath) {
		console.error(
			"Usage: tsx src/cli.ts <path/to/T-###.usage.json> [path/to/T-###-slug.md]",
		);
		process.exit(1);
	}
	ingestUsageArtifact(usageJsonPath, reportPath)
		.then(() => {
			console.log(`Ingested ${usageJsonPath}`);
		})
		.catch((err) => {
			console.error("Ingestion failed:", err);
			process.exit(1);
		});
}
