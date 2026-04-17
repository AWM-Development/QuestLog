import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Source } from "../../types.js";
import { SourceList } from "./SourceList.js";

function makeSource(overrides: Partial<Source> = {}): Source {
	return {
		id: "s1",
		campaignId: "c1",
		name: "curse-of-strahd.pdf",
		type: "pdf",
		mimeType: "application/pdf",
		sizeBytes: 5000000,
		hash: "h1",
		status: "done",
		metadata: { pageCount: 142 },
		createdAt: new Date("2026-03-12T12:00:00"),
		updatedAt: new Date("2026-03-12T12:00:00"),
		...overrides,
	};
}

describe("SourceList", () => {
	it("renders source names", () => {
		const sources = [
			makeSource({ id: "1", name: "curse-of-strahd.pdf" }),
			makeSource({ id: "2", name: "worldbuilding.md" }),
		];
		render(<SourceList sources={sources} />);

		expect(screen.getByText("curse-of-strahd.pdf")).toBeInTheDocument();
		expect(screen.getByText("worldbuilding.md")).toBeInTheDocument();
	});

	it("renders a success dot for each source", () => {
		const sources = [makeSource()];
		render(<SourceList sources={sources} />);

		expect(screen.getByLabelText("Imported")).toBeInTheDocument();
	});

	it("shows page count when metadata.pageCount is set", () => {
		const sources = [makeSource({ metadata: { pageCount: 142 } })];
		render(<SourceList sources={sources} />);

		expect(screen.getByText(/142 pages/i)).toBeInTheDocument();
	});

	it("shows import date", () => {
		const sources = [
			makeSource({ createdAt: new Date("2026-03-12T12:00:00") }),
		];
		render(<SourceList sources={sources} />);

		expect(screen.getByText(/imported Mar 12/i)).toBeInTheDocument();
	});

	it("renders nothing when sources list is empty", () => {
		const { container } = render(<SourceList sources={[]} />);
		expect(container.firstChild).toBeNull();
	});
});
