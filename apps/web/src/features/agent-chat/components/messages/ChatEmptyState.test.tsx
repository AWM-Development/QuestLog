import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ChatEmptyState } from "./ChatEmptyState.js";

describe("ChatEmptyState", () => {
	it("renders heading and subtext", () => {
		render(<ChatEmptyState onStarterClick={vi.fn()} />);
		expect(
			screen.getByText("What would you like to explore?"),
		).toBeInTheDocument();
		expect(
			screen.getByText(/Ask about your campaign lore/),
		).toBeInTheDocument();
	});

	it("renders 4 starter prompts", () => {
		render(<ChatEmptyState onStarterClick={vi.fn()} />);
		expect(screen.getByText("Prep next session")).toBeInTheDocument();
		expect(screen.getByText("Recap last session")).toBeInTheDocument();
		expect(screen.getByText("Generate NPC dialogue")).toBeInTheDocument();
		expect(screen.getByText("What loose threads exist?")).toBeInTheDocument();
	});

	it("calls onStarterClick with prompt text when clicked", () => {
		const onStarterClick = vi.fn();
		render(<ChatEmptyState onStarterClick={onStarterClick} />);
		fireEvent.click(screen.getByText("Prep next session"));
		expect(onStarterClick).toHaveBeenCalledWith("Prep next session");
	});
});
