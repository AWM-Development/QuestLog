import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SessionMetadata } from "./SessionMetadata.js";

const baseProps = {
	sessionNumber: 9,
	title: "The Feast of St. Andral",
	date: new Date(2026, 2, 15), // 2026-03-15 local
	status: "draft" as const,
	onTitleCommit: vi.fn(),
	onDateCommit: vi.fn(),
};

describe("SessionMetadata", () => {
	it("renders the overline as SESSION N · DATE · DRAFT for a draft", () => {
		render(<SessionMetadata {...baseProps} />);
		const overline = screen.getByTestId("session-overline");
		expect(overline.textContent).toMatch(/SESSION 9/);
		expect(overline.textContent).toMatch(/MAR 15, 2026/);
		expect(overline.textContent).toMatch(/DRAFT/);
	});

	it("renders a check prefix and no DRAFT label when finalized", () => {
		render(<SessionMetadata {...baseProps} status="finalized" />);
		const overline = screen.getByTestId("session-overline");
		expect(overline.textContent).toMatch(/✓/);
		expect(overline.textContent).toMatch(/SESSION 9/);
		expect(overline.textContent).not.toMatch(/DRAFT/);
	});

	it("renders a borderless title input pre-populated from props", () => {
		render(<SessionMetadata {...baseProps} />);
		const input = screen.getByLabelText("Session title") as HTMLInputElement;
		expect(input.value).toBe("The Feast of St. Andral");
	});

	it("commits title changes on blur", () => {
		const onTitleCommit = vi.fn();
		render(<SessionMetadata {...baseProps} onTitleCommit={onTitleCommit} />);
		const input = screen.getByLabelText("Session title") as HTMLInputElement;
		fireEvent.change(input, { target: { value: "New Title" } });
		fireEvent.blur(input);
		expect(onTitleCommit).toHaveBeenCalledWith("New Title");
	});

	it("exposes a click-to-edit date control", () => {
		render(<SessionMetadata {...baseProps} />);
		const dateButton = screen.getByLabelText("Edit session date");
		expect(dateButton).toBeTruthy();
	});

	it("does not render an inline session-number input", () => {
		render(<SessionMetadata {...baseProps} />);
		expect(screen.queryByLabelText(/Session #/)).toBeNull();
	});
});
