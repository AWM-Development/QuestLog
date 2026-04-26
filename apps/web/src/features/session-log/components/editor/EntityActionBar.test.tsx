import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EntityActionBar } from "./EntityActionBar.js";

vi.mock("@/lib/trpc.js", () => ({
	trpc: {
		entity: {
			detectSpans: { useQuery: vi.fn(() => ({ data: [], isLoading: false })) },
		},
	},
	createTRPCClient: vi.fn(() => ({})),
}));

const defaultProps = {
	spanText: "Strahd",
	entityId: "abc123",
	entityType: "npc" as const,
	campaignId: "11111111-1111-1111-1111-111111111111",
	position: { top: 100, left: 50 },
	onDismiss: vi.fn(),
	onCreate: vi.fn(),
	onLink: vi.fn(),
	onClose: vi.fn(),
};

describe("EntityActionBar", () => {
	it("renders Create and Dismiss buttons", () => {
		const { getByRole, queryByRole } = render(
			<EntityActionBar {...defaultProps} />,
		);
		expect(queryByRole("button", { name: /link/i })).toBeNull();
		expect(getByRole("button", { name: /create/i })).toBeTruthy();
		expect(getByRole("button", { name: /dismiss/i })).toBeTruthy();
	});

	it("clicking Dismiss calls onDismiss with span text", () => {
		const onDismiss = vi.fn();
		const { getByRole } = render(
			<EntityActionBar {...defaultProps} onDismiss={onDismiss} />,
		);
		fireEvent.click(getByRole("button", { name: /dismiss/i }));
		expect(onDismiss).toHaveBeenCalledWith("Strahd");
	});

	it("clicking Create calls onCreate", () => {
		const onCreate = vi.fn();
		const { getByRole } = render(
			<EntityActionBar {...defaultProps} onCreate={onCreate} />,
		);
		fireEvent.click(getByRole("button", { name: /create/i }));
		expect(onCreate).toHaveBeenCalled();
	});

	it("pressing Escape calls onClose", () => {
		const onClose = vi.fn();
		const { container } = render(
			<EntityActionBar {...defaultProps} onClose={onClose} />,
		);
		fireEvent.keyDown(container.firstChild as HTMLElement, { key: "Escape" });
		expect(onClose).toHaveBeenCalled();
	});

	it("Dismiss button has error color style", () => {
		const { getByRole } = render(<EntityActionBar {...defaultProps} />);
		const btn = getByRole("button", { name: /dismiss/i });
		const style = btn.getAttribute("style") ?? "";
		// color should reference --status-error
		expect(style).toContain("--status-error");
	});
});
