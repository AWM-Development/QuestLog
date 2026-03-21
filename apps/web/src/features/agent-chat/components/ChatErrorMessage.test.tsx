import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ChatErrorMessage } from "./ChatErrorMessage.js";

describe("ChatErrorMessage", () => {
	it("renders generic error card with retry button", () => {
		const onRetry = vi.fn();
		render(
			<ChatErrorMessage
				error={{ data: { code: "INTERNAL_SERVER_ERROR" } }}
				onRetry={onRetry}
			/>,
		);
		expect(screen.getByText(/Something went wrong/)).toBeInTheDocument();
		fireEvent.click(screen.getByText(/Try again/));
		expect(onRetry).toHaveBeenCalledOnce();
	});

	it("renders rate limit card with countdown", () => {
		vi.useFakeTimers();
		render(
			<ChatErrorMessage
				error={{ data: { code: "TOO_MANY_REQUESTS" } }}
				onRetry={vi.fn()}
			/>,
		);
		expect(screen.getByText(/AI service is busy/)).toBeInTheDocument();
		expect(screen.getByText(/Retry in 10s/)).toBeInTheDocument();

		// Advance 10 seconds
		act(() => {
			vi.advanceTimersByTime(10000);
		});
		expect(screen.getByText(/Try again/)).not.toBeDisabled();
		vi.useRealTimers();
	});
});
