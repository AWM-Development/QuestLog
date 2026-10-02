import type { TicketCard } from "@questlog/shared";
import { describe, expect, it } from "vitest";
import {
	BOARD_COLUMNS,
	extractDependencyChips,
	groupByStatus,
} from "./columns.js";

function card(over: Partial<TicketCard>): TicketCard {
	return {
		id: "T-001",
		title: "A ticket",
		priority: "P1",
		complexityTier: "M",
		blockedOn: null,
		gatedOn: null,
		branch: null,
		scopeExcerpt: null,
		status: "queue",
		path: "Docs/tickets/queue/T-001-a.md",
		...over,
	};
}

describe("BOARD_COLUMNS", () => {
	it("is the fixed six-column order mirroring Docs/tickets/ folders", () => {
		expect(BOARD_COLUMNS.map((c) => c.status)).toEqual([
			"gated",
			"backlog",
			"queue",
			"in-progress",
			"blocked",
			"done",
		]);
		expect(BOARD_COLUMNS.map((c) => c.name)).toEqual([
			"Gated",
			"Backlog",
			"Queue",
			"In-progress",
			"Blocked",
			"Done",
		]);
	});
});

describe("groupByStatus", () => {
	it("buckets cards by status and keeps empty columns present", () => {
		const grouped = groupByStatus([
			card({ id: "T-001", status: "queue" }),
			card({ id: "T-002", status: "done" }),
			card({ id: "T-003", status: "queue" }),
		]);
		expect(grouped.queue.map((c) => c.id)).toEqual(["T-001", "T-003"]);
		expect(grouped.done.map((c) => c.id)).toEqual(["T-002"]);
		expect(grouped.blocked).toEqual([]);
		expect(Object.keys(grouped)).toHaveLength(6);
	});
});

describe("extractDependencyChips", () => {
	it("returns no chips when neither field is present", () => {
		expect(extractDependencyChips(card({}))).toEqual([]);
	});

	it("pulls ticket ids out of free-text Blocked on, ignoring prose, deduped", () => {
		const chips = extractDependencyChips(
			card({
				blockedOn: "T-057, T-165 — must both be merged (T-057 stands up the shell)",
			}),
		);
		expect(chips).toEqual([
			{ kind: "blocked", label: "T-057" },
			{ kind: "blocked", label: "T-165" },
		]);
	});

	it("emits gated chips after blocked chips", () => {
		const chips = extractDependencyChips(
			card({ blockedOn: "T-010", gatedOn: "G-043" }),
		);
		expect(chips).toEqual([
			{ kind: "blocked", label: "T-010" },
			{ kind: "gated", label: "G-043" },
		]);
	});
});
