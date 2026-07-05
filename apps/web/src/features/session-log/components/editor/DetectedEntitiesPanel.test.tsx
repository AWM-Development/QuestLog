import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { EntitySpan } from "../../types.js";
import { DetectedEntitiesPanel } from "./DetectedEntitiesPanel.js";

const npcSpan: EntitySpan = {
	entityId: "e1",
	entityName: "Strahd",
	entityType: "npc",
	startIndex: 0,
	endIndex: 6,
	matchType: "confirmed",
	candidates: [],
};

const ambiguousSpan: EntitySpan = {
	entityId: "e2",
	entityName: "Guard",
	entityType: "npc",
	startIndex: 10,
	endIndex: 15,
	matchType: "ambiguous",
	candidates: [
		{ id: "e2", name: "Guard" },
		{ id: "e3", name: "Guard Captain" },
	],
};

const unlinkedSpan: EntitySpan = {
	entityId: "",
	entityName: "Dark One",
	entityType: "npc",
	startIndex: 20,
	endIndex: 28,
	matchType: "unlinked",
	candidates: [],
};

const defaultProps = {
	detectedSpans: [] as EntitySpan[],
	onScrollToSpan: vi.fn(),
	onActivateActionBar: vi.fn(),
};

const ambiguousSpanForDock: EntitySpan = {
	entityId: "",
	entityName: "Strahd",
	entityType: "npc",
	startIndex: 0,
	endIndex: 6,
	matchType: "ambiguous",
	candidates: [
		{ id: "e1", name: "Strahd von Zarovich" },
		{ id: "e2", name: "Count Strahd" },
	],
};

describe("DetectedEntitiesPanel", () => {
	it("renders empty state when no spans", () => {
		const { container } = render(<DetectedEntitiesPanel {...defaultProps} />);
		expect(
			container.querySelector('[data-testid="dock-empty-state"]'),
		).toBeTruthy();
	});

	it("groups entities by type and omits types with 0 spans", () => {
		const { getByText, queryByText } = render(
			<DetectedEntitiesPanel
				{...defaultProps}
				detectedSpans={[npcSpan, ambiguousSpan]}
			/>,
		);
		expect(getByText(/npc/i)).toBeTruthy();
		expect(queryByText(/faction/i)).toBeNull();
		expect(queryByText(/location/i)).toBeNull();
	});

	it("renders confirmed row with solid status dot", () => {
		const { container } = render(
			<DetectedEntitiesPanel {...defaultProps} detectedSpans={[npcSpan]} />,
		);
		const dot = container.querySelector("[data-status-dot='confirmed']");
		expect(dot).toBeTruthy();
	});

	it("renders ambiguous row with warning dot and n matches label", () => {
		const { container, getByText } = render(
			<DetectedEntitiesPanel
				{...defaultProps}
				detectedSpans={[ambiguousSpan]}
			/>,
		);
		const dot = container.querySelector("[data-status-dot='ambiguous']");
		expect(dot).toBeTruthy();
		expect(getByText(/2 matches/i)).toBeTruthy();
	});

	it("renders no footer", () => {
		const { queryByRole } = render(
			<DetectedEntitiesPanel {...defaultProps} detectedSpans={[npcSpan]} />,
		);
		expect(queryByRole("button", { name: /resolve all/i })).toBeNull();
	});

	it("clicking confirmed row calls onScrollToSpan", () => {
		const onScrollToSpan = vi.fn();
		const { getByText } = render(
			<DetectedEntitiesPanel
				{...defaultProps}
				detectedSpans={[npcSpan]}
				onScrollToSpan={onScrollToSpan}
			/>,
		);
		fireEvent.click(getByText("Strahd"));
		expect(onScrollToSpan).toHaveBeenCalledWith(npcSpan);
	});

	it("switches to hovering mode when hoveredSpan is set", () => {
		const { container } = render(
			<DetectedEntitiesPanel
				{...defaultProps}
				hoveredSpan={ambiguousSpanForDock}
				onSelectCandidate={vi.fn()}
				onCreateNew={vi.fn()}
				onSkipHover={vi.fn()}
			/>,
		);
		expect(
			container.querySelector('[data-testid="hover-card-kicker"]'),
		).toBeTruthy();
	});

	it("shows campaign entity count in empty state footer", () => {
		const { getByTestId } = render(
			<DetectedEntitiesPanel {...defaultProps} campaignEntityCount={42} />,
		);
		const footer = getByTestId("dock-entity-count");
		expect(footer.textContent).toContain("42");
	});

	it("shows count badge pill in header when entities are detected", () => {
		const { container } = render(
			<DetectedEntitiesPanel
				{...defaultProps}
				detectedSpans={[npcSpan]}
				campaignEntityCount={5}
			/>,
		);
		expect(container.querySelector('[data-testid="count-badge"]')).toBeTruthy();
	});

	it("empty state shows token-colored entity type words", () => {
		const { container } = render(<DetectedEntitiesPanel {...defaultProps} />);
		const emptyState = container.querySelector(
			'[data-testid="dock-empty-state"]',
		);
		expect(emptyState).toBeTruthy();
	});

	it("clicking unresolved row calls onActivateActionBar", () => {
		const onActivateActionBar = vi.fn();
		const { getByText } = render(
			<DetectedEntitiesPanel
				{...defaultProps}
				detectedSpans={[unlinkedSpan]}
				onActivateActionBar={onActivateActionBar}
			/>,
		);
		fireEvent.click(getByText("Dark One"));
		expect(onActivateActionBar).toHaveBeenCalledWith(unlinkedSpan);
	});
});
