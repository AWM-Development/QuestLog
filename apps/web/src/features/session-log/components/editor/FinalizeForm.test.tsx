import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FinalizeForm } from "./FinalizeForm.js";

const defaultProps = {
	initialTitle: "Session 1",
	initialSessionNumber: 1,
	initialDate: new Date("2026-04-25T12:00:00.000Z"),
	initialSummary: null,
	initialTags: [],
	onConfirm: vi.fn(),
	onCancel: vi.fn(),
	isSubmitting: false,
	unresolvedCount: 0,
	onReviewInEditor: vi.fn(),
};

describe("FinalizeForm", () => {
	it("hides the warning block when unresolvedCount is 0", () => {
		const { queryByText } = render(
			<FinalizeForm {...defaultProps} unresolvedCount={0} />,
		);
		expect(queryByText(/unresolved/i)).toBeNull();
	});

	it("shows warning block with correct count when unresolvedCount > 0", () => {
		const { getByText } = render(
			<FinalizeForm {...defaultProps} unresolvedCount={3} />,
		);
		expect(getByText(/3 entity suggestions unresolved/i)).toBeTruthy();
		expect(getByText(/haven't been linked/i)).toBeTruthy();
	});

	it("clicking Review in editor calls onReviewInEditor", () => {
		const onReviewInEditor = vi.fn();
		const { getByRole } = render(
			<FinalizeForm
				{...defaultProps}
				unresolvedCount={2}
				onReviewInEditor={onReviewInEditor}
			/>,
		);
		fireEvent.click(getByRole("button", { name: /review in editor/i }));
		expect(onReviewInEditor).toHaveBeenCalled();
	});

	it("save button is callable even when unresolvedCount > 0 (warning is soft)", () => {
		const onConfirm = vi.fn();
		const { getByRole } = render(
			<FinalizeForm
				{...defaultProps}
				unresolvedCount={5}
				onConfirm={onConfirm}
			/>,
		);
		const saveBtn = getByRole("button", { name: /finalize/i });
		expect(saveBtn).toBeTruthy();
		fireEvent.click(saveBtn);
		expect(onConfirm).toHaveBeenCalled();
	});
});
