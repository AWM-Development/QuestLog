import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SourceChip } from "./SourceChip.js";

describe("SourceChip", () => {
	it("renders source name", () => {
		render(
			<SourceChip
				source={{ chunkId: "c1", sourceName: "notes.pdf", sourceId: "s1" }}
			/>,
		);
		expect(screen.getByText(/notes\.pdf/)).toBeInTheDocument();
	});

	it("applies document colors for .pdf source", () => {
		render(
			<SourceChip
				source={{ chunkId: "c1", sourceName: "lore.pdf", sourceId: "s1" }}
			/>,
		);
		const btn = screen.getByRole("button");
		expect(btn).toHaveStyle({ color: "var(--ent-npc)" });
	});

	it("applies session colors for session source", () => {
		render(
			<SourceChip
				source={{ chunkId: "c1", sourceName: "Session 5", sourceId: "s1" }}
			/>,
		);
		const btn = screen.getByRole("button");
		expect(btn).toHaveStyle({ color: "var(--ent-faction)" });
	});

	it("applies entity colors for other sources", () => {
		render(
			<SourceChip
				source={{ chunkId: "c1", sourceName: "Gandalf", sourceId: "s1" }}
			/>,
		);
		const btn = screen.getByRole("button");
		expect(btn).toHaveStyle({ color: "var(--ent-location)" });
	});

	it("calls onClick when clicked", () => {
		const onClick = vi.fn();
		render(
			<SourceChip
				source={{ chunkId: "c1", sourceName: "test", sourceId: "s1" }}
				onClick={onClick}
			/>,
		);
		fireEvent.click(screen.getByRole("button"));
		expect(onClick).toHaveBeenCalledOnce();
	});
});
