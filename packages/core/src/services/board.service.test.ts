import { describe, expect, it, vi } from "vitest";
import {
	type GhRunner,
	createBoardService,
	parseTicketFile,
} from "./board.service.js";

const TICKET_WITH_NEITHER = `# T-100 — Neither field ticket

Milestone ref: M-TEST.1

Complexity tier: S

Strategy-gate flag: no

Priority: P2

Branch: feat/m-test/t-100-neither-field-ticket

Context files (load ONLY these):
  - foo.ts

Scope: does a thing.
`;

const TICKET_WITH_BOTH = `# T-101 — Both fields ticket

Milestone ref: M-TEST.1

Complexity tier: M

Priority: P0

Blocked on: T-099 — must be merged into develop first

Gated on: G-050 — must be resolved via /ungate first

Branch: feat/m-test/t-101-both-fields-ticket

Context files (load ONLY these):
  - bar.ts

Scope: does another thing.
`;

// Scope's prose runs to exactly 172 characters (well past the 160-char cap),
// with a space at position 160 so the word-boundary truncation is
// unambiguous — this is the ticket's own long-scope fixture, not a repurposed one.
const LONG_SCOPE_PROSE =
	"Extend the board service to additionally parse a Branch field and a truncated Scope excerpt from each ticket file, reusing matchField exactly the way every other field already does its own parsing here.";

const TICKET_WITH_LONG_SCOPE = `# T-102 — Long scope ticket

Milestone ref: M-TEST.1

Complexity tier: S

Priority: P1

Branch: feat/m-test/t-102-long-scope-ticket

Context files (load ONLY these):
  - qux.ts

Scope: ${LONG_SCOPE_PROSE}

Out of scope:
  - Nothing relevant to this fixture.
`;

const SHORT_SCOPE_PROSE = "A short scope under the truncation cap.";

const TICKET_WITH_SHORT_SCOPE = `# T-103 — Short scope ticket

Milestone ref: M-TEST.1

Complexity tier: S

Priority: P1

Branch: feat/m-test/t-103-short-scope-ticket

Context files (load ONLY these):
  - quux.ts

Scope: ${SHORT_SCOPE_PROSE}

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol
`;

// Mimics a gate-stub-adjacent card: has a valid T-### header (so it still
// parses as a card) but predates the Branch:/Scope: fields entirely — the
// case parseTicketFile must fall back to null for, per T-165's Scope.
const TICKET_WITHOUT_BRANCH_OR_SCOPE = `# T-104 — Legacy ticket with no Branch or Scope field

Milestone ref: M-TEST.1

Complexity tier: XS

Priority: P2

Context files (load ONLY these):
  - legacy.ts
`;

const GATE_STUB = `# G-050 — Some open design question

Gate type: 🎨 design

Milestone ref: M-TEST.1

Opened: 2026-08-01 — by Alex/agent during planning

Context files (load ONLY these):
  - baz.ts

Open question: what should this look like?

Blocks: T-101 — Both fields ticket
`;

describe("parseTicketFile", () => {
	it("parses priority/tier/blocked-on/gated-on when both Blocked on and Gated on are present", () => {
		const card = parseTicketFile(
			TICKET_WITH_BOTH,
			"Docs/tickets/backlog/T-101-both-fields-ticket.md",
		);
		expect(card).toEqual({
			id: "T-101",
			title: "Both fields ticket",
			priority: "P0",
			complexityTier: "M",
			blockedOn: "T-099 — must be merged into develop first",
			gatedOn: "G-050 — must be resolved via /ungate first",
			branch: "feat/m-test/t-101-both-fields-ticket",
			scopeExcerpt: "does another thing.",
			status: "backlog",
			path: "Docs/tickets/backlog/T-101-both-fields-ticket.md",
		});
	});

	it("parses a ticket with neither Blocked on nor Gated on as null for both", () => {
		const card = parseTicketFile(
			TICKET_WITH_NEITHER,
			"Docs/tickets/queue/T-100-neither-field-ticket.md",
		);
		expect(card).toEqual({
			id: "T-100",
			title: "Neither field ticket",
			priority: "P2",
			complexityTier: "S",
			blockedOn: null,
			gatedOn: null,
			branch: "feat/m-test/t-100-neither-field-ticket",
			scopeExcerpt: "does a thing.",
			status: "queue",
			path: "Docs/tickets/queue/T-100-neither-field-ticket.md",
		});
	});

	it("truncates a Scope over 160 characters at the nearest preceding word boundary with a trailing …", () => {
		const card = parseTicketFile(
			TICKET_WITH_LONG_SCOPE,
			"Docs/tickets/queue/T-102-long-scope-ticket.md",
		);
		expect(card?.branch).toBe("feat/m-test/t-102-long-scope-ticket");
		expect(card?.scopeExcerpt?.length).toBeLessThanOrEqual(161); // 160 + the trailing "…"
		expect(card?.scopeExcerpt?.endsWith("…")).toBe(true);
		expect(
			LONG_SCOPE_PROSE.startsWith(card?.scopeExcerpt?.slice(0, -1) ?? ""),
		).toBe(true);
	});

	it("returns the full Scope text with no trailing … when it's under 160 characters", () => {
		const card = parseTicketFile(
			TICKET_WITH_SHORT_SCOPE,
			"Docs/tickets/queue/T-103-short-scope-ticket.md",
		);
		expect(card?.scopeExcerpt).toBe(SHORT_SCOPE_PROSE);
	});

	it("returns branch: null and scopeExcerpt: null for a ticket file with neither field (legacy/gate-stub-adjacent)", () => {
		const card = parseTicketFile(
			TICKET_WITHOUT_BRANCH_OR_SCOPE,
			"Docs/tickets/queue/T-104-legacy-ticket-with-no-branch-or-scope-field.md",
		);
		expect(card?.branch).toBeNull();
		expect(card?.scopeExcerpt).toBeNull();
	});

	it.each([
		["backlog", "backlog"],
		["queue", "queue"],
		["in-progress", "in-progress"],
		["done", "done"],
		["blocked", "blocked"],
	] as const)(
		"derives status %s from the Docs/tickets/%s/ folder",
		(folder, status) => {
			const card = parseTicketFile(
				TICKET_WITH_NEITHER,
				`Docs/tickets/${folder}/T-100-neither-field-ticket.md`,
			);
			expect(card?.status).toBe(status);
		},
	);

	it("derives status 'gated' for a ticket file directly under Docs/tickets/gated/", () => {
		const card = parseTicketFile(
			TICKET_WITH_NEITHER,
			"Docs/tickets/gated/T-100-neither-field-ticket.md",
		);
		expect(card?.status).toBe("gated");
	});

	it("does not derive 'gated' status for a file under Docs/tickets/gated/resolved/", () => {
		// gated/resolved/ isn't a pipeline status — a ticket file there is
		// legacy/inert, not a card on the board.
		const card = parseTicketFile(
			TICKET_WITH_NEITHER,
			"Docs/tickets/gated/resolved/T-100-neither-field-ticket.md",
		);
		expect(card).toBeNull();
	});

	it("skips a gate-stub (no T-### header) under Docs/tickets/gated/ rather than returning a malformed card", () => {
		const card = parseTicketFile(
			GATE_STUB,
			"Docs/tickets/gated/G-050-some-open-design-question.md",
		);
		expect(card).toBeNull();
	});

	it("returns null for a file outside any recognized pipeline folder", () => {
		const card = parseTicketFile(
			TICKET_WITH_NEITHER,
			"Docs/tickets/archive/T-100-x.md",
		);
		expect(card).toBeNull();
	});
});

describe("listBoard", () => {
	const treeResponse = {
		tree: [
			{
				path: "Docs/tickets/backlog/T-101-both-fields-ticket.md",
				type: "blob",
			},
			{
				path: "Docs/tickets/queue/T-100-neither-field-ticket.md",
				type: "blob",
			},
			{
				path: "Docs/tickets/gated/G-050-some-open-design-question.md",
				type: "blob",
			},
			{ path: "Docs/tickets/reports/T-055-x.md", type: "blob" },
			{ path: "Docs/tickets/backlog", type: "tree" },
		],
	};

	function makeGh(contentByPath: Record<string, string>): GhRunner {
		return vi.fn(async (args: string[]) => {
			if (args[0] === "api" && args[1]?.includes("/git/trees/")) {
				return treeResponse;
			}
			if (args[0] === "api" && args[1]?.includes("/contents/")) {
				const pathArg = args[1].split("/contents/")[1]?.split("?")[0];
				const decoded = decodeURIComponent(pathArg ?? "");
				return {
					content: Buffer.from(contentByPath[decoded] ?? "").toString("base64"),
				};
			}
			throw new Error(`unexpected gh invocation: ${args.join(" ")}`);
		});
	}

	it("fetches the Docs/tickets/ tree, parses each ticket file, and skips non-ticket/gate-stub files", async () => {
		const gh = makeGh({
			"Docs/tickets/backlog/T-101-both-fields-ticket.md": TICKET_WITH_BOTH,
			"Docs/tickets/queue/T-100-neither-field-ticket.md": TICKET_WITH_NEITHER,
			"Docs/tickets/gated/G-050-some-open-design-question.md": GATE_STUB,
		});

		const cards = await createBoardService(gh).list(() => 0);

		expect(cards.map((c) => c.id).sort()).toEqual(["T-100", "T-101"]);
	});

	it("does not re-fetch within the cache TTL, but does after it expires", async () => {
		const gh = makeGh({
			"Docs/tickets/backlog/T-101-both-fields-ticket.md": TICKET_WITH_BOTH,
			"Docs/tickets/queue/T-100-neither-field-ticket.md": TICKET_WITH_NEITHER,
			"Docs/tickets/gated/G-050-some-open-design-question.md": GATE_STUB,
		});
		const service = createBoardService(gh);

		let now = 0;
		const clock = () => now;

		await service.list(clock);
		const callsAfterFirst = (gh as ReturnType<typeof vi.fn>).mock.calls.length;

		now += 30_000; // within the 60s TTL
		await service.list(clock);
		expect((gh as ReturnType<typeof vi.fn>).mock.calls.length).toBe(
			callsAfterFirst,
		);

		now += 40_000; // past the 60s TTL (70s total)
		await service.list(clock);
		expect((gh as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(
			callsAfterFirst,
		);
	});
});
