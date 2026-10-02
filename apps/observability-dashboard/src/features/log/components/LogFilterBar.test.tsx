import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LogFilterBar } from "./LogFilterBar.js";

describe("LogFilterBar", () => {
	it("calls onFilterChange with the clicked outcome", () => {
		const onFilterChange = vi.fn();
		render(<LogFilterBar filter="all" onFilterChange={onFilterChange} />);

		fireEvent.click(screen.getByRole("button", { name: /shipped only/i }));
		expect(onFilterChange).toHaveBeenCalledWith("shipped");

		fireEvent.click(screen.getByRole("button", { name: /blocked only/i }));
		expect(onFilterChange).toHaveBeenCalledWith("blocked");

		fireEvent.click(screen.getByRole("button", { name: /all outcomes/i }));
		expect(onFilterChange).toHaveBeenCalledWith("all");
	});

	it("marks the active filter button", () => {
		render(<LogFilterBar filter="blocked" onFilterChange={vi.fn()} />);

		expect(screen.getByRole("button", { name: /blocked only/i })).toHaveClass(
			"on",
		);
		expect(
			screen.getByRole("button", { name: /shipped only/i }),
		).not.toHaveClass("on");
	});
});
