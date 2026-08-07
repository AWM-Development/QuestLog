import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { UsageArtifact } from "@questlog/core/usage-capture/artifact.js";
import { describe, expect, it } from "vitest";
import {
	mapReportToTicketReport,
	mapUsageArtifactToTicketRun,
} from "./ingest.js";

const fixturesDir = fileURLToPath(new URL("./__fixtures__", import.meta.url));

function readFixture(name: string): string {
	return readFileSync(`${fixturesDir}/${name}`, "utf-8");
}

describe("mapUsageArtifactToTicketRun", () => {
	it("maps a ticket run's usage.json fields to the exact expected ticket_runs row", () => {
		const artifact = JSON.parse(
			readFixture("T-999.usage.json"),
		) as UsageArtifact;

		expect(mapUsageArtifactToTicketRun(artifact)).toEqual({
			ticketId: "T-999",
			emptyRun: false,
			sessionId: "fixture-session-id",
			inputTokens: 100,
			outputTokens: 200,
			cacheCreationInputTokens: 300,
			cacheReadInputTokens: 400,
			durationMs: 12345,
			turnCount: 10,
			turnsToGreen: 7,
			appliesRate: "intro",
			theoreticalCostIntroUsd: 1.5,
			theoreticalCostStandardUsd: 2.25,
			reviewerSubagent: null,
			totalSystemCostIntroUsd: 1.5,
			totalSystemCostStandardUsd: 2.25,
		});
	});

	it("maps an empty-run (ticket_id: null, empty_run: true) fixture without dropping fields", () => {
		const artifact = JSON.parse(
			readFixture("empty-run-fixture.usage.json"),
		) as UsageArtifact;

		const row = mapUsageArtifactToTicketRun(artifact);

		expect(row.ticketId).toBeNull();
		expect(row.emptyRun).toBe(true);
		expect(row.turnsToGreen).toBeNull();
		expect(row.sessionId).toBe("fixture-empty-run-session-id");
	});

	it("maps a fixture with a non-null reviewer_subagent sub-object", () => {
		const artifact: UsageArtifact = {
			ticket_id: "T-998",
			empty_run: false,
			session_id: "fixture-with-reviewer",
			input_tokens: 10,
			output_tokens: 20,
			cache_creation_input_tokens: 30,
			cache_read_input_tokens: 40,
			duration_ms: 500,
			turn_count: 5,
			turns_to_green: 3,
			theoretical_cost_usd: {
				applies_rate: "standard",
				intro_usd: 0.5,
				standard_usd: 0.75,
			},
			reviewer_subagent: {
				input_tokens: 1,
				output_tokens: 2,
				cache_creation_input_tokens: 3,
				cache_read_input_tokens: 4,
				theoretical_cost_usd: {
					applies_rate: "standard",
					intro_usd: 0.05,
					standard_usd: 0.08,
				},
			},
			total_system_cost_usd: {
				applies_rate: "standard",
				intro_usd: 0.55,
				standard_usd: 0.83,
			},
		};

		const row = mapUsageArtifactToTicketRun(artifact);

		expect(row.reviewerSubagent).toEqual(artifact.reviewer_subagent);
		expect(row.totalSystemCostIntroUsd).toBe(0.55);
		expect(row.totalSystemCostStandardUsd).toBe(0.83);
	});
});

describe("mapReportToTicketReport", () => {
	it("parses reviewer_verdict and remediation_pass_required from a shipped report fixture", () => {
		const content = readFixture("T-999-fixture-report.md");

		expect(
			mapReportToTicketReport({
				ticketId: "T-999",
				reportType: "shipped",
				content,
			}),
		).toEqual({
			ticketId: "T-999",
			reportType: "shipped",
			reviewerVerdict: "PASS-WITH-NOTES",
			remediationPassRequired: true,
			content,
		});
	});

	it("produces a null reviewer_verdict and false remediation_pass_required when neither is present", () => {
		const content = "# T-997 — no reviewer section\n\n**Outcome:** blocked\n";

		expect(
			mapReportToTicketReport({
				ticketId: "T-997",
				reportType: "blocked",
				content,
			}),
		).toEqual({
			ticketId: "T-997",
			reportType: "blocked",
			reviewerVerdict: null,
			remediationPassRequired: false,
			content,
		});
	});

	it("parses a plain PASS verdict with no remediation line", () => {
		const content = "## Reviewer verdict\n\n**PASS**\n\n> All good.\n";

		const row = mapReportToTicketReport({
			ticketId: "T-996",
			reportType: "shipped",
			content,
		});

		expect(row.reviewerVerdict).toBe("PASS");
		expect(row.remediationPassRequired).toBe(false);
	});
});
