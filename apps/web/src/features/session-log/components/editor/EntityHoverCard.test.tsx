import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { EntitySpan } from "../../types.js";
import { EntityHoverCard } from "./EntityHoverCard.js";

const ambiguousSpan: EntitySpan = {
	entityId: "",
	entityName: "Guard",
	entityType: "npc",
	startIndex: 0,
	endIndex: 5,
	matchType: "ambiguous",
	candidates: [
		{ id: "e1", name: "Guard Captain" },
		{ id: "e2", name: "City Guard" },
	],
};

const defaultProps = {
	span: ambiguousSpan,
	onSelectCandidate: vi.fn(),
	onCreateNew: vi.fn(),
	onSkip: vi.fn(),
};

describe("EntityHoverCard", () => {
	it("renders the type kicker with candidate count", () => {
		const { container } = render(<EntityHoverCard {...defaultProps} />);
		const kicker = container.querySelector('[data-testid="hover-card-kicker"]');
		expect(kicker).toBeTruthy();
		expect(kicker?.textContent).toContain("NPC");
		expect(kicker?.textContent).toContain("2");
	});

	it("renders the ambiguous span text as heading", () => {
		const { getByTestId } = render(<EntityHoverCard {...defaultProps} />);
		expect(getByTestId("hover-card-heading").textContent).toContain("Guard");
	});

	it("renders all candidate rows", () => {
		const { getByText } = render(<EntityHoverCard {...defaultProps} />);
		expect(getByText("Guard Captain")).toBeTruthy();
		expect(getByText("City Guard")).toBeTruthy();
	});

	it("first candidate is preselected", () => {
		const { container } = render(<EntityHoverCard {...defaultProps} />);
		const rows = container.querySelectorAll('[data-testid="candidate-row"]');
		expect(rows[0]?.getAttribute("aria-selected")).toBe("true");
		expect(rows[1]?.getAttribute("aria-selected")).toBe("false");
	});

	it("clicking a candidate calls onSelectCandidate", () => {
		const onSelectCandidate = vi.fn();
		const { getByText } = render(
			<EntityHoverCard
				{...defaultProps}
				onSelectCandidate={onSelectCandidate}
			/>,
		);
		fireEvent.click(getByText("City Guard"));
		expect(onSelectCandidate).toHaveBeenCalledWith({
			id: "e2",
			name: "City Guard",
		});
	});

	it("Create new button calls onCreateNew", () => {
		const onCreateNew = vi.fn();
		const { getByRole } = render(
			<EntityHoverCard {...defaultProps} onCreateNew={onCreateNew} />,
		);
		fireEvent.click(getByRole("button", { name: /create new npc/i }));
		expect(onCreateNew).toHaveBeenCalledTimes(1);
	});

	it("Skip button calls onSkip", () => {
		const onSkip = vi.fn();
		const { getByRole } = render(
			<EntityHoverCard {...defaultProps} onSkip={onSkip} />,
		);
		fireEvent.click(getByRole("button", { name: /skip/i }));
		expect(onSkip).toHaveBeenCalledTimes(1);
	});
});
