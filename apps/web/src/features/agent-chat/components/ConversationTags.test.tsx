import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ConversationTags } from "./ConversationTags.js";

describe("ConversationTags", () => {
	it("renders existing tags with remove buttons", () => {
		render(
			<ConversationTags
				tags={["lore", "combat"]}
				allTags={["lore", "combat", "npc"]}
				onUpdateTags={vi.fn()}
			/>,
		);
		expect(screen.getByText("lore")).toBeInTheDocument();
		expect(screen.getByText("combat")).toBeInTheDocument();
		expect(screen.getByLabelText("Remove tag lore")).toBeInTheDocument();
	});

	it("removes a tag when × is clicked", () => {
		const onUpdateTags = vi.fn();
		render(
			<ConversationTags
				tags={["lore", "combat"]}
				allTags={["lore", "combat"]}
				onUpdateTags={onUpdateTags}
			/>,
		);
		fireEvent.click(screen.getByLabelText("Remove tag lore"));
		expect(onUpdateTags).toHaveBeenCalledWith(["combat"]);
	});

	it("opens popover when '+ tag' is clicked", () => {
		render(
			<ConversationTags tags={[]} allTags={["lore"]} onUpdateTags={vi.fn()} />,
		);
		fireEvent.click(screen.getByText("+ tag"));
		expect(
			screen.getByPlaceholderText("Add or create tag..."),
		).toBeInTheDocument();
	});

	it("filters suggestions when typing in popover", () => {
		render(
			<ConversationTags
				tags={[]}
				allTags={["lore", "combat", "npc"]}
				onUpdateTags={vi.fn()}
			/>,
		);
		fireEvent.click(screen.getByText("+ tag"));
		const input = screen.getByPlaceholderText("Add or create tag...");
		fireEvent.change(input, { target: { value: "lor" } });
		expect(screen.getByText("lore")).toBeInTheDocument();
		expect(screen.queryByText("combat")).not.toBeInTheDocument();
	});
});
