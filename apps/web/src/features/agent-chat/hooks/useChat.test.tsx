import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useChat } from "./useChat.js";

const invalidateMessages = vi.fn();
const invalidateList = vi.fn();
const useQueryMock = vi.fn();

vi.mock("../../../lib/trpc.js", () => ({
	trpc: {
		useUtils: () => ({
			conversation: {
				getMessages: { invalidate: invalidateMessages },
				list: { invalidate: invalidateList },
			},
		}),
		conversation: {
			getMessages: {
				useQuery: (...args: unknown[]) => useQueryMock(...args),
			},
		},
	},
}));

function streamFromText(chunks: string[]): ReadableStream<Uint8Array> {
	const encoder = new TextEncoder();
	return new ReadableStream({
		start(controller) {
			for (const chunk of chunks) {
				controller.enqueue(encoder.encode(chunk));
			}
			controller.close();
		},
	});
}

function HookHarness() {
	const { sendMessage, retry, isLoading, isStreaming, error } = useChat(
		"campaign-1",
		"conversation-1",
	);

	return (
		<div>
			<button type="button" onClick={() => void sendMessage("Who is Strahd?")}>
				Send
			</button>
			<button type="button" onClick={retry}>
				Retry
			</button>
			<div data-testid="loading">{String(isLoading)}</div>
			<div data-testid="streaming">{String(isStreaming)}</div>
			<div data-testid="error">{error?.data?.code ?? ""}</div>
		</div>
	);
}

describe("useChat", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		useQueryMock.mockReturnValue({ data: [] });
	});

	it("handles streaming success and invalidates on done", async () => {
		invalidateMessages.mockResolvedValue(undefined);
		invalidateList.mockResolvedValue(undefined);

		global.fetch = vi.fn().mockResolvedValue({
			ok: true,
			body: streamFromText([
				'event: delta\ndata: {"text":"Strahd "}\n\n',
				'event: delta\ndata: {"text":"is here"}\n\n',
				'event: done\ndata: {"citations":[],"confidence":0.9}\n\n',
			]),
		}) as unknown as typeof fetch;

		render(<HookHarness />);
		fireEvent.click(screen.getByText("Send"));

		await waitFor(() => {
			expect(screen.getByTestId("loading")).toHaveTextContent("false");
		});

		expect(screen.getByTestId("error")).toHaveTextContent("");
		expect(invalidateMessages).toHaveBeenCalledWith({
			conversationId: "conversation-1",
		});
		expect(invalidateList).toHaveBeenCalledWith({ campaignId: "campaign-1" });
	});

	it("surfaces SSE error events and skips invalidation", async () => {
		invalidateMessages.mockResolvedValue(undefined);
		invalidateList.mockResolvedValue(undefined);

		global.fetch = vi.fn().mockResolvedValue({
			ok: true,
			body: streamFromText([
				'event: error\ndata: {"message":"rate_limit_exceeded","code":429}\n\n',
			]),
		}) as unknown as typeof fetch;

		render(<HookHarness />);
		fireEvent.click(screen.getByText("Send"));

		await waitFor(() => {
			expect(screen.getByTestId("error")).toHaveTextContent(
				"TOO_MANY_REQUESTS",
			);
		});

		expect(invalidateMessages).not.toHaveBeenCalled();
		expect(invalidateList).not.toHaveBeenCalled();
	});

	it("retries the previous query", async () => {
		invalidateMessages.mockResolvedValue(undefined);
		invalidateList.mockResolvedValue(undefined);

		global.fetch = vi
			.fn()
			.mockResolvedValueOnce({
				ok: true,
				body: streamFromText([
					'event: error\ndata: {"message":"rate_limit_exceeded","code":429}\n\n',
				]),
			})
			.mockResolvedValueOnce({
				ok: true,
				body: streamFromText(['event: done\ndata: {"citations":[]}\n\n']),
			}) as unknown as typeof fetch;

		render(<HookHarness />);
		fireEvent.click(screen.getByText("Send"));

		await waitFor(() => {
			expect(screen.getByTestId("error")).toHaveTextContent(
				"TOO_MANY_REQUESTS",
			);
		});

		fireEvent.click(screen.getByText("Retry"));

		await waitFor(() => {
			expect(invalidateMessages).toHaveBeenCalled();
		});
		expect(global.fetch).toHaveBeenCalledTimes(2);
	});
});
