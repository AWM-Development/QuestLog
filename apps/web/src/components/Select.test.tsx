import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Select } from "./primitives/Select.js";

describe("Select", () => {
	it("renders select options", () => {
		render(
			<Select aria-label="Theme">
				<option value="fantasy">Fantasy</option>
			</Select>,
		);
		expect(screen.getByLabelText("Theme")).toBeInTheDocument();
		expect(screen.getByText("Fantasy")).toBeInTheDocument();
	});

	it("applies focus style", () => {
		render(
			<Select aria-label="Theme">
				<option value="fantasy">Fantasy</option>
			</Select>,
		);
		const select = screen.getByLabelText("Theme");
		fireEvent.focus(select);
		expect(select).toHaveStyle({
			boxShadow: "0 0 0 3px var(--state-active-soft)",
		});
	});

	it("forwards onChange", () => {
		const onChange = vi.fn();
		render(
			<Select aria-label="Theme" onChange={onChange}>
				<option value="fantasy">Fantasy</option>
				<option value="horror">Horror</option>
			</Select>,
		);
		fireEvent.change(screen.getByLabelText("Theme"), {
			target: { value: "horror" },
		});
		expect(onChange).toHaveBeenCalledTimes(1);
	});
});
