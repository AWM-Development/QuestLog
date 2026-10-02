import type { TicketCard, TicketStatus } from "@questlog/shared";

export interface BoardColumnDef {
	status: TicketStatus;
	name: string;
	emptyHeadline: string;
	emptySub: string;
}

/** Fixed left-to-right order, mirroring `Docs/tickets/`'s real folders 1:1 (G-043). */
export const BOARD_COLUMNS: readonly BoardColumnDef[] = [
	{
		status: "gated",
		name: "Gated",
		emptyHeadline: "Nothing gated",
		emptySub: "No ticket is waiting on an open G-### decision.",
	},
	{
		status: "backlog",
		name: "Backlog",
		emptyHeadline: "Backlog is empty",
		emptySub: "Nothing staged behind the queue right now.",
	},
	{
		status: "queue",
		name: "Queue",
		emptyHeadline: "Queue is empty",
		emptySub: "No tickets are up next for the executor.",
	},
	{
		status: "in-progress",
		name: "In-progress",
		emptyHeadline: "Nothing running",
		emptySub: "The executor is idle — next pickup is the earliest queued ticket.",
	},
	{
		status: "blocked",
		name: "Blocked",
		emptyHeadline: "Nothing blocked",
		emptySub: "No ticket is stalled on a dependency or the iteration cap.",
	},
	{
		status: "done",
		name: "Done",
		emptyHeadline: "Nothing shipped yet",
		emptySub: "Completed tickets land here once merged.",
	},
];

export function groupByStatus(
	cards: readonly TicketCard[],
): Record<TicketStatus, TicketCard[]> {
	const grouped = Object.fromEntries(
		BOARD_COLUMNS.map((c) => [c.status, [] as TicketCard[]]),
	) as Record<TicketStatus, TicketCard[]>;
	for (const card of cards) grouped[card.status].push(card);
	return grouped;
}

export interface DependencyChip {
	kind: "blocked" | "gated";
	label: string;
}

const ID_PATTERN = /\b[TG]-\d+\b/g;

function ids(text: string | null): string[] {
	return [...new Set(text?.match(ID_PATTERN) ?? [])];
}

/** `Blocked on:` is free prose after the ids (T-057's own is a paragraph), so chips are the ids only. */
export function extractDependencyChips(card: TicketCard): DependencyChip[] {
	return [
		...ids(card.blockedOn).map((label) => ({ kind: "blocked" as const, label })),
		...ids(card.gatedOn).map((label) => ({ kind: "gated" as const, label })),
	];
}
