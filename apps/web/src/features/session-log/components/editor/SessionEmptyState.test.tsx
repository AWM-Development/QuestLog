import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SessionEmptyState } from "./SessionEmptyState.js";

describe("SessionEmptyState", () => {
	it("renders all four action buttons", () => {
		const { getByRole } = render(<SessionEmptyState onDismiss={vi.fn()} />);
		expect(getByRole("button", { name: /begin blank/i })).toBeTruthy();
		expect(getByRole("button", { name: /paste from clipboard/i })).toBeTruthy();
		expect(getByRole("button", { name: /pull recap/i })).toBeTruthy();
		expect(getByRole("button", { name: /prep brief/i })).toBeTruthy();
	});

	it('"Begin blank" calls onDismiss', () => {
		const onDismiss = vi.fn();
		const { getByRole } = render(<SessionEmptyState onDismiss={onDismiss} />);
		fireEvent.click(getByRole("button", { name: /begin blank/i }));
		expect(onDismiss).toHaveBeenCalledTimes(1);
	});

	it('"Start from prep brief" button is disabled', () => {
		const { getByRole } = render(<SessionEmptyState onDismiss={vi.fn()} />);
		const prepBtn = getByRole("button", { name: /prep brief/i });
		expect((prepBtn as HTMLButtonElement).disabled).toBe(true);
	});

	it("renders the mascot tile", () => {
		const { container } = render(<SessionEmptyState onDismiss={vi.fn()} />);
		expect(container.querySelector('[data-testid="mascot-tile"]')).toBeTruthy();
	});
});
