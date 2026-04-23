import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithRouter } from "../../test-utils.js";
import { Card } from "./Card.js";

describe("Card", () => {
	it("renders children", () => {
		render(<Card>Hello card</Card>);
		expect(screen.getByText("Hello card")).toBeInTheDocument();
	});

	it("as=div renders a div (default)", () => {
		const { container } = render(<Card>div content</Card>);
		expect(container.firstChild?.nodeName).toBe("DIV");
	});

	it("as=button renders a button with type=button", () => {
		render(
			<Card as="button" onClick={vi.fn()}>
				Click me
			</Card>,
		);
		const btn = screen.getByRole("button");
		expect(btn).toBeInTheDocument();
		expect(btn).toHaveAttribute("type", "button");
	});

	it("as=link renders a link element", () => {
		renderWithRouter([
			{
				path: "/",
				element: (
					<Card as="link" href="/foo">
						Go somewhere
					</Card>
				),
			},
		]);
		expect(
			screen.getByRole("link", { name: "Go somewhere" }),
		).toBeInTheDocument();
	});

	it("applies cardSurface styles", () => {
		const { container } = render(<Card>styled</Card>);
		const el = container.firstChild as HTMLElement;
		expect(el).toHaveStyle({ backgroundColor: "var(--bg-elevated)" });
	});

	it("hoverable applies hover bg on mouseenter", () => {
		const { container } = render(<Card hoverable>hover me</Card>);
		const el = container.firstChild as HTMLElement;
		fireEvent.mouseEnter(el);
		expect(el).toHaveStyle({ backgroundColor: "var(--bg-focal)" });
	});

	it("calls onClick when as=button is clicked", () => {
		const onClick = vi.fn();
		render(
			<Card as="button" onClick={onClick}>
				Click
			</Card>,
		);
		fireEvent.click(screen.getByRole("button"));
		expect(onClick).toHaveBeenCalledTimes(1);
	});
});
