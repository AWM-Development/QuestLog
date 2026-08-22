import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FilterBar } from "./FilterBar.js";

describe("FilterBar", () => {
	it("calls onRangeChange with the clicked range", () => {
		const onRangeChange = vi.fn();
		render(
			<FilterBar
				range="30"
				onRangeChange={onRangeChange}
				excludeEmpty={true}
				onToggleExcludeEmpty={vi.fn()}
			/>,
		);

		fireEvent.click(screen.getByRole("button", { name: /last 90 runs/i }));
		expect(onRangeChange).toHaveBeenCalledWith("90");

		fireEvent.click(screen.getByRole("button", { name: /all time/i }));
		expect(onRangeChange).toHaveBeenCalledWith("all");
	});

	it("marks the active range button", () => {
		render(
			<FilterBar
				range="90"
				onRangeChange={vi.fn()}
				excludeEmpty={true}
				onToggleExcludeEmpty={vi.fn()}
			/>,
		);

		expect(screen.getByRole("button", { name: /last 90 runs/i })).toHaveClass(
			"on",
		);
		expect(
			screen.getByRole("button", { name: /last 30 runs/i }),
		).not.toHaveClass("on");
	});

	it("calls onToggleExcludeEmpty when the exclude-empty button is clicked", () => {
		const onToggle = vi.fn();
		render(
			<FilterBar
				range="30"
				onRangeChange={vi.fn()}
				excludeEmpty={true}
				onToggleExcludeEmpty={onToggle}
			/>,
		);

		fireEvent.click(
			screen.getByRole("button", { name: /exclude empty runs/i }),
		);
		expect(onToggle).toHaveBeenCalled();
	});
});
