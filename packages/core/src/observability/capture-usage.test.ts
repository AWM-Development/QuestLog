import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { captureUsage, resolveActiveTicketId } from "./capture-usage.js";

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
			join(outDir, "Docs/tickets/cost-reports/T-046.usage.json"),
		);
		if (artifactPath === null || artifact === null) {
			throw new Error("expected a ticket run to produce an artifact");
		}
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

	it("writes nothing when no ticket id resolves — non-ticket sessions aren't tracked", () => {
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

		expect(artifactPath).toBeNull();
		expect(artifact).toBeNull();
		expect(existsSync(join(outDir, "Docs"))).toBe(false);
	});

	it("writes to Docs/tickets/cost-reports/T-XXX.usage.json when the active-ticket marker names T-XXX", () => {
		const dir = mkdtempSync(join(tmpdir(), "questlog-capture-usage-"));
		outDir = dir;
		mkdirSync(join(dir, "tmp"), { recursive: true });
		writeFileSync(join(dir, "tmp", ".active-ticket"), "T-061\n");

		const { artifactPath, artifact } = captureUsage(
			{
				transcript_path: join(
					FIXTURES,
					"session-no-ticket",
					"transcript.jsonl",
				),
				session_id: "sess-marker",
			},
			dir,
			{ resolveTicketId: () => resolveActiveTicketId(dir) },
		);

		expect(artifactPath).toBe(
			join(dir, "Docs/tickets/cost-reports/T-061.usage.json"),
		);
		if (artifact === null) {
			throw new Error("expected a ticket run to produce an artifact");
		}
		expect(artifact.ticket_id).toBe("T-061");
		expect(artifact.empty_run).toBe(false);
	});

	it("writes nothing with no marker, even when done/blocked files or commit history would point at a different ticket", () => {
		const dir = mkdtempSync(join(tmpdir(), "questlog-capture-usage-"));
		outDir = dir;
		// No tmp/.active-ticket written — simulate a repo with unrelated
		// done/blocked history that the old heuristic would have guessed from.
		mkdirSync(join(dir, "Docs/tickets/done"), { recursive: true });
		writeFileSync(
			join(dir, "Docs/tickets/done", "T-999-unrelated.md"),
			"# unrelated",
		);

		const { artifactPath, artifact } = captureUsage(
			{
				transcript_path: join(
					FIXTURES,
					"session-no-ticket",
					"transcript.jsonl",
				),
				session_id: "sess-no-marker",
			},
			dir,
			{ resolveTicketId: () => resolveActiveTicketId(dir) },
		);

		expect(artifactPath).toBeNull();
		expect(artifact).toBeNull();
	});
});

describe("resolveActiveTicketId", () => {
	it("returns the marker's trimmed contents when tmp/.active-ticket exists", () => {
		const dir = mkdtempSync(join(tmpdir(), "questlog-active-ticket-"));
		mkdirSync(join(dir, "tmp"), { recursive: true });
		writeFileSync(join(dir, "tmp", ".active-ticket"), "T-061\n");

		expect(resolveActiveTicketId(dir)).toBe("T-061");

		rmSync(dir, { recursive: true, force: true });
	});

	it("returns null when the marker file is absent", () => {
		const dir = mkdtempSync(join(tmpdir(), "questlog-active-ticket-"));

		expect(resolveActiveTicketId(dir)).toBeNull();

		rmSync(dir, { recursive: true, force: true });
	});
});
