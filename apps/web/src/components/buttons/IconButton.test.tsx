import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { IconButton } from "./IconButton.js";

describe("IconButton", () => {
	it("renders with aria-label from label prop", () => {
		render(<IconButton label="Close">×</IconButton>);
		expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
	});

	it("renders children", () => {
		render(<IconButton label="Go">↑</IconButton>);
		expect(screen.getByText("↑")).toBeInTheDocument();
	});

	it("has type=button", () => {
		render(<IconButton label="Action">⚙</IconButton>);
		expect(screen.getByRole("button")).toHaveAttribute("type", "button");
	});

	it("size=24 sets 24px width and height", () => {
		render(
			<IconButton label="Small" size={24}>
				×
			</IconButton>,
		);
		expect(screen.getByRole("button")).toHaveStyle({
			width: "24px",
			height: "24px",
		});
	});

	it("size=28 sets 28px width and height", () => {
		render(
			<IconButton label="Medium" size={28}>
				×
			</IconButton>,
		);
		expect(screen.getByRole("button")).toHaveStyle({
			width: "28px",
			height: "28px",
		});
	});

	it("size=32 sets 32px width and height", () => {
		render(
			<IconButton label="Large" size={32}>
				×
			</IconButton>,
		);
		expect(screen.getByRole("button")).toHaveStyle({
			width: "32px",
			height: "32px",
		});
	});

	it("calls onClick when clicked", () => {
		const onClick = vi.fn();
		render(
			<IconButton label="Click" onClick={onClick}>
				○
			</IconButton>,
		);
		fireEvent.click(screen.getByRole("button"));
		expect(onClick).toHaveBeenCalledTimes(1);
	});

	it("active prop applies accent color", () => {
		render(
			<IconButton label="Active" active>
				●
			</IconButton>,
		);
		expect(screen.getByRole("button")).toHaveStyle({
			color: "var(--accent)",
		});
	});
});
