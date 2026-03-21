import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ConversationListItem } from "./ConversationListItem.js";

const makeConversation = (overrides = {}) => ({
	id: "conv-1",
	title: "Test Conversation",
	tags: ["lore", "npc"],
	status: "active",
	updatedAt: new Date(),
	...overrides,
});

describe("ConversationListItem", () => {
	it("renders title and timestamp", () => {
		render(
			<ConversationListItem
				conversation={makeConversation()}
				isActive={false}
				onSelect={vi.fn()}
				onArchive={vi.fn()}
				onEditTitle={vi.fn()}
			/>,
		);
		expect(screen.getByText("Test Conversation")).toBeInTheDocument();
		expect(screen.getByText("Just now")).toBeInTheDocument();
	});

	it("renders 'Untitled conversation' when title is null", () => {
		render(
			<ConversationListItem
				conversation={makeConversation({ title: null })}
				isActive={false}
				onSelect={vi.fn()}
				onArchive={vi.fn()}
				onEditTitle={vi.fn()}
			/>,
		);
		expect(screen.getByText("Untitled conversation")).toBeInTheDocument();
	});

	it("renders tags", () => {
		render(
			<ConversationListItem
				conversation={makeConversation()}
				isActive={false}
				onSelect={vi.fn()}
				onArchive={vi.fn()}
				onEditTitle={vi.fn()}
			/>,
		);
		expect(screen.getByText("lore")).toBeInTheDocument();
		expect(screen.getByText("npc")).toBeInTheDocument();
	});

	it("calls onSelect when clicked", () => {
		const onSelect = vi.fn();
		render(
			<ConversationListItem
				conversation={makeConversation()}
				isActive={false}
				onSelect={onSelect}
				onArchive={vi.fn()}
				onEditTitle={vi.fn()}
			/>,
		);
		fireEvent.click(screen.getByText("Test Conversation"));
		expect(onSelect).toHaveBeenCalledWith("conv-1");
	});
});
