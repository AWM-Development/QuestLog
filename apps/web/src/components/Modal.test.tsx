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

	it("calls onClose when Escape key is pressed on the overlay", () => {
		const onClose = vi.fn();
		render(
			<Modal title="Test" onClose={onClose}>
				Content
			</Modal>,
		);
		const overlay = document.querySelector(".modal-overlay") as HTMLElement;
		fireEvent.keyDown(overlay, { key: "Escape" });
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
});
