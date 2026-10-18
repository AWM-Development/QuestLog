import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/trpc.js", () => ({
	trpc: { board: { list: { useQuery: vi.fn() } } },
	createTRPCClient: vi.fn(() => ({})),
}));

import { trpc } from "@/lib/trpc.js";
import { BOARD_COLUMN_STYLE, BoardPage } from "./BoardPage.js";

const mockList = trpc.board.list.useQuery as ReturnType<typeof vi.fn>;

const base = {
	priority: "P1",
	complexityTier: "M",
	blockedOn: null,
	gatedOn: null,
	branch: null,
	scopeExcerpt: null,
};

const FIXTURE = [
	{
		...base,
		id: "G-900",
		title: "Gated one",
		status: "gated",
		path: "a",
		gatedOn: "G-900",
	},
	{
		...base,
		id: "T-010",
		title: "Backlog one",
		status: "backlog",
		path: "b",
		blockedOn: "T-001",
	},
	{
		...base,
		id: "T-020",
		title: "Queue one",
		status: "queue",
		path: "c",
		priority: "P0",
		complexityTier: "S",
		scopeExcerpt: "Short scope preview…",
		branch: "feat/x/t-020-queue-one",
		blockedOn: "T-001, T-002, T-003 — all of them",
		gatedOn: "G-043",
	},
	{
		...base,
		id: "T-030",
		title: "Running one",
		status: "in-progress",
		path: "d",
	},
	{
		...base,
		id: "T-040",
		title: "Done one",
		status: "done",
		path: "e",
		complexityTier: "L",
	},
];

function column(name: string) {
	return screen.getByTestId(`column-${name}`);
}

describe("BoardPage", () => {
	beforeEach(() => mockList.mockReset());

	it("places each ticket in its status column, with chips only where the data has them", () => {
		mockList.mockReturnValue({
			data: FIXTURE,
			isLoading: false,
			isError: false,
		});
		render(<BoardPage />);

		expect(within(column("gated")).getByText("Gated one")).toBeInTheDocument();
		expect(
			within(column("backlog")).getByText("Backlog one"),
		).toBeInTheDocument();
		expect(within(column("queue")).getByText("Queue one")).toBeInTheDocument();
		expect(
			within(column("in-progress")).getByText("Running one"),
		).toBeInTheDocument();
		expect(within(column("done")).getByText("Done one")).toBeInTheDocument();

		expect(within(column("in-progress")).queryByTestId("chip-row")).toBeNull();
		expect(within(column("done")).queryByTestId("chip-row")).toBeNull();
		expect(within(column("backlog")).getByText("T-001")).toBeInTheDocument();
	});

	it("caps visible chips at 2 and shows a +N overflow chip", () => {
		mockList.mockReturnValue({
			data: FIXTURE,
			isLoading: false,
			isError: false,
		});
		render(<BoardPage />);
		const q = column("queue");
		expect(within(q).getByText("T-001")).toBeInTheDocument();
		expect(within(q).getByText("T-002")).toBeInTheDocument();
		expect(within(q).queryByText("T-003")).toBeNull();
		expect(within(q).getByText("+2")).toBeInTheDocument();
	});

	it("renders the plain empty state in an empty column", () => {
		mockList.mockReturnValue({
			data: FIXTURE,
			isLoading: false,
			isError: false,
		});
		render(<BoardPage />);
		expect(
			within(column("blocked")).getByText("Nothing blocked"),
		).toBeInTheDocument();
	});

	it("gives every column the identical fixed-width style (no per-column layout drift)", () => {
		mockList.mockReturnValue({
			data: FIXTURE,
			isLoading: false,
			isError: false,
		});
		render(<BoardPage />);
		const cols = screen.getAllByTestId(/^column-/);
		expect(cols).toHaveLength(6);
		for (const c of cols) {
			expect(c.style.flex).toBe(BOARD_COLUMN_STYLE.flex);
			expect(c.style.width).toBe(BOARD_COLUMN_STYLE.width);
		}
	});

	it("renders skeletons while loading", () => {
		mockList.mockReturnValue({
			data: undefined,
			isLoading: true,
			isError: false,
		});
		render(<BoardPage />);
		expect(screen.getAllByTestId("skeleton-card").length).toBeGreaterThan(0);
	});

	it("renders the error panel, not a crash, when board.list errors, and retry refetches", () => {
		const refetch = vi.fn();
		mockList.mockReturnValue({
			data: undefined,
			isLoading: false,
			isError: true,
			refetch,
		});
		render(<BoardPage />);
		expect(screen.getByText("Couldn't load the board")).toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: "Retry" }));
		expect(refetch).toHaveBeenCalled();
	});

	it("opens a details modal with full untruncated data and closes via × or backdrop", () => {
		mockList.mockReturnValue({
			data: FIXTURE,
			isLoading: false,
			isError: false,
		});
		render(<BoardPage />);
		fireEvent.click(screen.getByText("Queue one"));

		const modal = screen.getByRole("dialog");
		expect(within(modal).getByText("Queue one")).toBeInTheDocument();
		expect(
			within(modal).getByText("feat/x/t-020-queue-one"),
		).toBeInTheDocument();
		expect(within(modal).getByText("Short scope preview…")).toBeInTheDocument();
		expect(within(modal).getByText("Queue")).toBeInTheDocument();
		expect(within(modal).getByText("T-003")).toBeInTheDocument(); // overflow chip untruncated
		expect(within(modal).getByText("G-043")).toBeInTheDocument();

		fireEvent.click(screen.getByRole("button", { name: "Close" }));
		expect(screen.queryByRole("dialog")).toBeNull();

		fireEvent.click(screen.getByText("Queue one"));
		fireEvent.click(screen.getByTestId("modal-backdrop"));
		expect(screen.queryByRole("dialog")).toBeNull();
	});
});
