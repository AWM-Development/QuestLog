import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MessageList } from "./MessageList.js";

describe("MessageList", () => {
	it("shows loading skeleton when loading", () => {
		render(
			<MessageList
				messages={[]}
				isLoading={true}
				error={null}
				onRetry={vi.fn()}
				onStarterClick={vi.fn()}
				hasConversation={true}
			/>,
		);
		expect(screen.getByText("Loading messages...")).toBeInTheDocument();
	});

	it("shows empty state when no conversation selected", () => {
		render(
			<MessageList
				messages={[]}
				isLoading={false}
				error={null}
				onRetry={vi.fn()}
				onStarterClick={vi.fn()}
				hasConversation={false}
			/>,
		);
		expect(
			screen.getByText("What would you like to explore?"),
		).toBeInTheDocument();
	});

	it("renders user and agent messages in order", () => {
		const messages = [
			{ id: "1", role: "user" as const, content: "Hello" },
			{
				id: "2",
				role: "assistant" as const,
				content: "Hi there",
				sources: [],
			},
		];
		render(
			<MessageList
				messages={messages}
				isLoading={false}
				error={null}
				onRetry={vi.fn()}
				onStarterClick={vi.fn()}
				hasConversation={true}
			/>,
		);
		expect(screen.getByText("Hello")).toBeInTheDocument();
		expect(screen.getByText("Hi there")).toBeInTheDocument();
	});

	it("shows error message when error is present", () => {
		render(
			<MessageList
				messages={[{ id: "1", role: "user", content: "Hello" }]}
				isLoading={false}
				error={{ data: { code: "INTERNAL_SERVER_ERROR" } }}
				onRetry={vi.fn()}
				onStarterClick={vi.fn()}
				hasConversation={true}
			/>,
		);
		expect(screen.getByText(/Something went wrong/)).toBeInTheDocument();
	});
});
