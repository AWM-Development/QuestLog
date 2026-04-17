import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Modal } from "./Modal.js";

describe("Modal", () => {
	it("renders children", () => {
		render(
			<Modal title="Test Modal" onClose={vi.fn()}>
				<p>Modal content</p>
			</Modal>,
		);
		expect(screen.getByText("Modal content")).toBeInTheDocument();
	});

	it("renders the title", () => {
		render(
			<Modal title="Create Campaign" onClose={vi.fn()}>
				Content
			</Modal>,
		);
		expect(screen.getByText("Create Campaign")).toBeInTheDocument();
	});

	it("dialog is aria-labelled by the title", () => {
		render(
			<Modal title="My Dialog" onClose={vi.fn()}>
				Content
			</Modal>,
		);
		const dialog = screen.getByRole("dialog");
		const titleId = dialog.getAttribute("aria-labelledby");
		expect(titleId).toBeTruthy();
		const titleEl = document.getElementById(titleId as string);
		expect(titleEl?.textContent).toBe("My Dialog");
	});

	it("calls onClose when dialog cancel event fires", () => {
		const onClose = vi.fn();
		render(
			<Modal title="Test" onClose={onClose}>
				Content
			</Modal>,
		);
		const dialog = screen.getByRole("dialog");
		fireEvent(dialog, new Event("cancel", { bubbles: true, cancelable: true }));
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it("Escape does not double-call onClose", () => {
		const onClose = vi.fn();
		render(
			<Modal title="Test" onClose={onClose}>
				<input aria-label="field" />
			</Modal>,
		);
		const dialog = screen.getByRole("dialog");
		fireEvent(dialog, new Event("cancel", { bubbles: true, cancelable: true }));
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it("calls onClose when overlay backdrop is clicked", () => {
		const onClose = vi.fn();
		render(
			<Modal title="Test" onClose={onClose}>
				Content
			</Modal>,
		);
		const overlay = document.querySelector(".modal-overlay") as HTMLElement;
		fireEvent.click(overlay);
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it("does not call onClose when dialog content is clicked", () => {
		const onClose = vi.fn();
		render(
			<Modal title="Test" onClose={onClose}>
				<p>Inner</p>
			</Modal>,
		);
		fireEvent.click(screen.getByText("Inner"));
		expect(onClose).not.toHaveBeenCalled();
	});

	it("auto-focuses the first non-close focusable element", () => {
		render(
			<Modal title="Test" onClose={vi.fn()}>
				<button type="button" aria-label="Close">
					×
				</button>
				<input aria-label="first" />
				<input aria-label="second" />
			</Modal>,
		);
		expect(screen.getByLabelText("first")).toHaveFocus();
	});

	it("Tab from last focusable wraps to first (focus trap)", () => {
		render(
			<Modal title="Test" onClose={vi.fn()}>
				<input aria-label="a" />
				<input aria-label="b" />
			</Modal>,
		);
		const b = screen.getByLabelText("b");
		b.focus();
		fireEvent.keyDown(b, { key: "Tab" });
		expect(screen.getByLabelText("a")).toHaveFocus();
	});

	it("Shift+Tab from first focusable wraps to last (focus trap)", () => {
		render(
			<Modal title="Test" onClose={vi.fn()}>
				<input aria-label="a" />
				<input aria-label="b" />
			</Modal>,
		);
		const a = screen.getByLabelText("a");
		a.focus();
		fireEvent.keyDown(a, { key: "Tab", shiftKey: true });
		expect(screen.getByLabelText("b")).toHaveFocus();
	});

	it("generates a unique aria-labelledby id per instance", () => {
		const { rerender } = render(
			<Modal title="First" onClose={vi.fn()}>
				a
			</Modal>,
		);
		const firstId = screen.getByRole("dialog").getAttribute("aria-labelledby");
		rerender(
			<Modal title="Second" onClose={vi.fn()}>
				b
			</Modal>,
		);
		const secondId = screen.getByRole("dialog").getAttribute("aria-labelledby");
		expect(firstId).toBeTruthy();
		expect(secondId).toBeTruthy();
	});
});
