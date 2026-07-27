import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { captureUsage } from "./capture-usage.js";

const FIXTURES = join(__dirname, "__fixtures__");

let outDir: string | undefined;

afterEach(() => {
	if (outDir) {
		rmSync(outDir, { recursive: true, force: true });
		outDir = undefined;
	}
});

describe("captureUsage", () => {
	it("combines the main transcript and its sibling subagents/*.jsonl into one artifact file", () => {
		outDir = mkdtempSync(join(tmpdir(), "questlog-capture-usage-"));

		const { artifactPath, artifact } = captureUsage(
			{
				transcript_path: join(
					FIXTURES,
					"session-with-subagents",
					"transcript.jsonl",
				),
				session_id: "sess-with-subagents",
			},
			outDir,
			{ resolveTicketId: () => "T-046" },
		);

		expect(artifactPath).toBe(
			join(outDir, "Docs/tickets/reports/T-046.usage.json"),
		);
		expect(existsSync(artifactPath)).toBe(true);

		const written = JSON.parse(readFileSync(artifactPath, "utf-8"));
		expect(written).toEqual(artifact);

		expect(artifact.ticket_id).toBe("T-046");
		expect(artifact.empty_run).toBe(false);
		expect(artifact.input_tokens).toBe(1300);
		expect(artifact.output_tokens).toBe(300);
		expect(artifact.turns_to_green).toBe(1);
		expect(artifact.reviewer_subagent).not.toBeNull();
		expect(artifact.reviewer_subagent?.input_tokens).toBe(500);
		expect(artifact.reviewer_subagent?.output_tokens).toBe(80);
		expect(artifact.total_system_cost_usd.standard_usd).toBeCloseTo(
			artifact.theoretical_cost_usd.standard_usd +
				(artifact.reviewer_subagent?.theoretical_cost_usd.standard_usd ?? 0),
			6,
		);
	});

	it("produces an empty-run artifact instead of erroring when no ticket id resolves", () => {
		outDir = mkdtempSync(join(tmpdir(), "questlog-capture-usage-"));

		const { artifactPath, artifact } = captureUsage(
			{
				transcript_path: join(
					FIXTURES,
					"session-no-ticket",
					"transcript.jsonl",
				),
				session_id: "sess-no-ticket",
			},
			outDir,
			{ resolveTicketId: () => null },
		);

		expect(artifactPath).toBe(
			join(outDir, "Docs/tickets/reports/empty-run-sess-no-ticket.usage.json"),
		);
		expect(existsSync(artifactPath)).toBe(true);
		expect(artifact.ticket_id).toBeNull();
		expect(artifact.empty_run).toBe(true);
		expect(artifact.reviewer_subagent).toBeNull();
	});
});
