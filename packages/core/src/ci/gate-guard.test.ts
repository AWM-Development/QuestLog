import { describe, expect, it } from "vitest";
import {
	type GateGuardDeps,
	parseBlockedOn,
	parseGatedOn,
	runGateGuard,
} from "./gate-guard.js";

function deps(overrides: Partial<GateGuardDeps>): GateGuardDeps {
	return {
		listChangedFiles: () => [],
		readFile: () => null,
		listDir: () => [],
		...overrides,
	};
}

describe("parseGatedOn", () => {
	it("extracts the gate id from a Gated on: line", () => {
		expect(
			parseGatedOn("Priority: P1\n\nGated on: G-017 — must be resolved\n"),
		).toBe("G-017");
	});

	it("returns null when there is no Gated on: line", () => {
		expect(parseGatedOn("Priority: P1\n\nBranch: feat/x\n")).toBeNull();
	});
});

describe("parseBlockedOn", () => {
	it("extracts every ticket id from a Blocked on: line", () => {
		expect(
			parseBlockedOn(
				"Priority: P1\n\nBlocked on: T-054, T-055 — must be merged\n",
			),
		).toEqual(["T-054", "T-055"]);
	});

	it("returns an empty array when there is no Blocked on: line", () => {
		expect(parseBlockedOn("Priority: P1\n\nBranch: feat/x\n")).toEqual([]);
	});
});

describe("runGateGuard", () => {
	it("passes when no ticket files changed", () => {
		const result = runGateGuard(deps({}));
		expect(result.ok).toBe(true);
		expect(result.failures).toEqual([]);
	});

	it("fails a synthetic PR diff introducing a queue/ ticket with an unresolved Gated on:", () => {
		const result = runGateGuard(
			deps({
				listChangedFiles: () => ["Docs/tickets/queue/T-200-example.md"],
				readFile: (path) =>
					path === "Docs/tickets/queue/T-200-example.md"
						? "Priority: P1\n\nGated on: G-099 — must be resolved via /ungate first\n"
						: null,
				listDir: (path) =>
					path === "Docs/tickets/gated" ? ["G-099-example.md"] : [],
			}),
		);
		expect(result.ok).toBe(false);
		expect(result.failures).toHaveLength(1);
		expect(result.failures[0]?.message).toMatch(/G-099/);
	});

	it("passes a backlog/ ticket carrying an unresolved Gated on: — its designed resting state (GATE_SPEC.md)", () => {
		const result = runGateGuard(
			deps({
				listChangedFiles: () => ["Docs/tickets/backlog/T-200-example.md"],
				readFile: (path) =>
					path === "Docs/tickets/backlog/T-200-example.md"
						? "Priority: P1\n\nGated on: G-099 — must be resolved via /ungate first\n"
						: null,
				listDir: (path) =>
					path === "Docs/tickets/gated" ? ["G-099-example.md"] : [],
			}),
		);
		expect(result.ok).toBe(true);
		expect(result.failures).toEqual([]);
	});

	it("passes the same ticket once its Gated on: line is removed as part of the diff", () => {
		const result = runGateGuard(
			deps({
				listChangedFiles: () => ["Docs/tickets/queue/T-200-example.md"],
				readFile: (path) =>
					path === "Docs/tickets/queue/T-200-example.md"
						? "Priority: P1\n\nBranch: feat/x\n"
						: null,
				listDir: (path) =>
					path === "Docs/tickets/gated" ? ["G-099-example.md"] : [],
			}),
		);
		expect(result.ok).toBe(true);
	});

	it("fails a synthetic PR diff naming a Blocked on: ticket with no file in done/, in queue/", () => {
		const result = runGateGuard(
			deps({
				listChangedFiles: () => ["Docs/tickets/queue/T-201-example.md"],
				readFile: (path) =>
					path === "Docs/tickets/queue/T-201-example.md"
						? "Priority: P1\n\nBlocked on: T-999 — must be merged into develop first\n"
						: null,
				listDir: () => [],
			}),
		);
		expect(result.ok).toBe(false);
		expect(result.failures).toHaveLength(1);
		expect(result.failures[0]?.message).toMatch(/T-999/);
	});

	it("fails an in-progress/ ticket naming an unmet Blocked on: — the invariant still holds past backlog/", () => {
		const result = runGateGuard(
			deps({
				listChangedFiles: () => ["Docs/tickets/in-progress/T-201-example.md"],
				readFile: (path) =>
					path === "Docs/tickets/in-progress/T-201-example.md"
						? "Priority: P1\n\nBlocked on: T-999 — must be merged into develop first\n"
						: null,
				listDir: () => [],
			}),
		);
		expect(result.ok).toBe(false);
		expect(result.failures).toHaveLength(1);
	});

	it("passes a newly-drafted backlog/ ticket carrying an unmet Blocked on: — this is ticket-writer's normal output (TICKET_SPEC.md Lifecycle)", () => {
		const result = runGateGuard(
			deps({
				listChangedFiles: () => ["Docs/tickets/backlog/T-201-example.md"],
				readFile: (path) =>
					path === "Docs/tickets/backlog/T-201-example.md"
						? "Priority: P1\n\nBlocked on: T-999 — must be merged into develop first\n"
						: null,
				listDir: () => [],
			}),
		);
		expect(result.ok).toBe(true);
		expect(result.failures).toEqual([]);
	});

	it("passes a Blocked on: line naming a real ticket id already in done/", () => {
		const result = runGateGuard(
			deps({
				listChangedFiles: () => ["Docs/tickets/backlog/T-201-example.md"],
				readFile: (path) =>
					path === "Docs/tickets/backlog/T-201-example.md"
						? "Priority: P1\n\nBlocked on: T-080 — must be merged into develop first\n"
						: null,
				listDir: (path) =>
					path === "Docs/tickets/done" ? ["T-080-some-ticket.md"] : [],
			}),
		);
		expect(result.ok).toBe(true);
		expect(result.failures).toEqual([]);
	});

	it("warns (not fails) on a Gated on: reference already moved to gated/resolved/", () => {
		const result = runGateGuard(
			deps({
				listChangedFiles: () => ["Docs/tickets/backlog/T-202-example.md"],
				readFile: (path) =>
					path === "Docs/tickets/backlog/T-202-example.md"
						? "Priority: P1\n\nGated on: G-020 — must be resolved via /ungate first\n"
						: null,
				listDir: (path) =>
					path === "Docs/tickets/gated/resolved" ? ["G-020-resolved.md"] : [],
			}),
		);
		expect(result.ok).toBe(true);
		expect(result.failures).toEqual([]);
		expect(result.warnings).toHaveLength(1);
		expect(result.warnings[0]?.message).toMatch(/G-020/);
	});

	it("ignores non-ticket files in the diff", () => {
		const result = runGateGuard(
			deps({
				listChangedFiles: () => ["packages/core/src/ci/gate-guard.ts"],
			}),
		);
		expect(result.ok).toBe(true);
	});

	it("skips a changed ticket path whose file was deleted in the diff", () => {
		const result = runGateGuard(
			deps({
				listChangedFiles: () => ["Docs/tickets/queue/T-203-example.md"],
				readFile: () => null,
			}),
		);
		expect(result.ok).toBe(true);
	});
});
