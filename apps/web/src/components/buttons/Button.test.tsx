import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Button } from "./Button.js";

describe("Button", () => {
	it("renders a button with type=button by default", () => {
		render(<Button variant="accent">Click me</Button>);
		const btn = screen.getByRole("button", { name: "Click me" });
		expect(btn).toBeInTheDocument();
		expect(btn).toHaveAttribute("type", "button");
	});

	it("renders children", () => {
		render(<Button variant="accent">Hello</Button>);
		expect(screen.getByText("Hello")).toBeInTheDocument();
	});

	it("accent variant has accent background color", () => {
		render(<Button variant="accent">Accent</Button>);
		const btn = screen.getByRole("button");
		expect(btn).toHaveStyle({ backgroundColor: "var(--accent)" });
	});

	it("secondary variant has a border (distinguishes from accent)", () => {
		render(<Button variant="secondary">Secondary</Button>);
		const btn = screen.getByRole("button");
		expect(btn).toHaveStyle({ border: "0.5px solid var(--border)" });
	});

	it("disabled renders with not-allowed cursor and reduced opacity", () => {
		render(
			<Button variant="accent" disabled>
				Disabled
			</Button>,
		);
		const btn = screen.getByRole("button");
		expect(btn).toBeDisabled();
		expect(btn).toHaveStyle({ cursor: "not-allowed", opacity: "0.4" });
	});

	it("loading renders button as disabled with loading text", () => {
		render(
			<Button variant="accent" loading>
				Save
			</Button>,
		);
		const btn = screen.getByRole("button");
		expect(btn).toBeDisabled();
		expect(btn).toHaveStyle({ opacity: "0.6" });
	});

	it("calls onClick when clicked", () => {
		const onClick = vi.fn();
		render(
			<Button variant="accent" onClick={onClick}>
				Click
			</Button>,
		);
		fireEvent.click(screen.getByRole("button"));
		expect(onClick).toHaveBeenCalledTimes(1);
	});

	it("does not call onClick when disabled", () => {
		const onClick = vi.fn();
		render(
			<Button variant="accent" disabled onClick={onClick}>
				Click
			</Button>,
		);
		fireEvent.click(screen.getByRole("button"));
		expect(onClick).not.toHaveBeenCalled();
	});

	it("sm size uses smaller padding", () => {
		render(
			<Button variant="accent" size="sm">
				Small
			</Button>,
		);
		const btn = screen.getByRole("button");
		expect(btn).toHaveStyle({ fontSize: "0.75rem" });
	});

	it("accepts type=submit", () => {
		render(
			<Button variant="accent" type="submit">
				Submit
			</Button>,
		);
		expect(screen.getByRole("button")).toHaveAttribute("type", "submit");
	});
});
