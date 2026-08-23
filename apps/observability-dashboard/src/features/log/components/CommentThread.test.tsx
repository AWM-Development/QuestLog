import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const invalidate = vi.fn();
const mutate = vi.fn();

vi.mock("@/lib/trpc.js", () => {
	const mockTrpc = {
		comment: {
			list: { useQuery: vi.fn() },
			add: { useMutation: vi.fn() },
		},
		useUtils: vi.fn(),
	};
	return { trpc: mockTrpc, createTRPCClient: vi.fn(() => ({})) };
});

import { trpc } from "@/lib/trpc.js";
import { CommentThread } from "./CommentThread.js";

const mockList = trpc.comment.list.useQuery as ReturnType<typeof vi.fn>;
const mockAdd = trpc.comment.add.useMutation as ReturnType<typeof vi.fn>;
const mockUseUtils = trpc.useUtils as ReturnType<typeof vi.fn>;

function setup() {
	mockUseUtils.mockReturnValue({
		comment: { list: { invalidate } },
	});
	mockAdd.mockReturnValue({ mutate, isPending: false });
}

describe("CommentThread", () => {
	beforeEach(() => {
		invalidate.mockClear();
		mutate.mockClear();
	});

	it("renders existing comments with author chip, body, and timestamp", () => {
		setup();
		mockList.mockReturnValue({
			data: [
				{
					id: "c1",
					ticketId: "T-044",
					author: "alex",
					body: "Nice work.",
					createdAt: "2026-07-26T09:14:00Z",
				},
			],
		});

		render(<CommentThread ticketId="T-044" />);

		expect(screen.getByText("Nice work.")).toBeInTheDocument();
		expect(screen.getByText("alex")).toBeInTheDocument();
	});

	it("renders no comments without erroring when the thread is empty", () => {
		setup();
		mockList.mockReturnValue({ data: [] });

		render(<CommentThread ticketId="T-044" />);

		expect(screen.getByPlaceholderText(/add a comment/i)).toBeInTheDocument();
	});

	it("submitting non-empty text calls comment.add.mutate with the ticket id and body, then clears the textarea", () => {
		setup();
		mockList.mockReturnValue({ data: [] });
		render(<CommentThread ticketId="T-044" />);

		const textarea = screen.getByPlaceholderText(
			/add a comment/i,
		) as HTMLTextAreaElement;
		fireEvent.change(textarea, { target: { value: "Great catch." } });
		fireEvent.click(screen.getByRole("button", { name: /add comment/i }));

		expect(mutate).toHaveBeenCalledWith(
			{ ticketId: "T-044", body: "Great catch." },
			expect.anything(),
		);
	});

	it("does not call mutate when the textarea is empty or whitespace-only", () => {
		setup();
		mockList.mockReturnValue({ data: [] });
		render(<CommentThread ticketId="T-044" />);

		fireEvent.click(screen.getByRole("button", { name: /add comment/i }));
		expect(mutate).not.toHaveBeenCalled();
	});

	it("invalidates the thread's own comment.list query on a successful add (so the new comment appears without a full reload)", () => {
		setup();
		mockList.mockReturnValue({ data: [] });
		render(<CommentThread ticketId="T-044" />);

		const onSuccess = mockAdd.mock.calls.at(-1)?.[0]?.onSuccess;
		expect(onSuccess).toBeTypeOf("function");
		onSuccess();
		expect(invalidate).toHaveBeenCalledWith({ ticketId: "T-044" });
	});
});
