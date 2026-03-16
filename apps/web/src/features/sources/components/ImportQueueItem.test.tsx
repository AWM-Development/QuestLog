import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { LocalQueueItem, Source } from "../types.js";
import { ImportQueueItem } from "./ImportQueueItem.js";

const activeSource: Source = {
	id: "s1",
	campaignId: "c1",
	name: "worldbuilding-notes.md",
	type: "markdown",
	mimeType: "text/markdown",
	sizeBytes: 24000,
	hash: "h1",
	status: "chunking",
	metadata: {},
	createdAt: new Date(),
	updatedAt: new Date(),
};

const errorSource: Source = {
	...activeSource,
	id: "s2",
	status: "error",
	mimeType: "application/pdf",
};

const duplicateLocalItem: LocalQueueItem = {
	key: "test.txt::100",
	file: new File(["content"], "test.txt", { type: "text/plain" }),
	state: "waiting-duplicate",
	existingSource: {
		...activeSource,
		id: "existing-s1",
		status: "done",
		createdAt: new Date("2026-03-10"),
		updatedAt: new Date("2026-03-10"),
	},
};

describe("ImportQueueItem", () => {
	it("shows file name and status text for a DB source", () => {
		render(<ImportQueueItem source={activeSource} onPasteText={vi.fn()} />);

		expect(screen.getByText("worldbuilding-notes.md")).toBeInTheDocument();
		expect(screen.getByText(/splitting into chunks/i)).toBeInTheDocument();
	});

	it("shows progress bar", () => {
		render(<ImportQueueItem source={activeSource} onPasteText={vi.fn()} />);
		expect(screen.getByLabelText(/progress/i)).toBeInTheDocument();
	});

	it("shows EmberPlaceholder", () => {
		render(<ImportQueueItem source={activeSource} onPasteText={vi.fn()} />);
		expect(screen.getByLabelText(/ember/i)).toBeInTheDocument();
	});

	it("shows DuplicatePrompt when local item is in waiting-duplicate state", () => {
		render(
			<ImportQueueItem
				localItem={duplicateLocalItem}
				onResolveDuplicate={vi.fn()}
				onPasteText={vi.fn()}
			/>,
		);

		expect(screen.getByText(/already imported/i)).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: /replace/i }),
		).toBeInTheDocument();
	});

	it("shows ErrorState when source status is error", () => {
		render(<ImportQueueItem source={errorSource} onPasteText={vi.fn()} />);

		expect(screen.getByText(/could not be processed/i)).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: /paste text instead/i }),
		).toBeInTheDocument();
	});

	it("shows file name from local item", () => {
		const uploadingItem: LocalQueueItem = {
			key: "upload.txt::50",
			file: new File(["x"], "upload.txt", { type: "text/plain" }),
			state: "uploading",
		};
		render(<ImportQueueItem localItem={uploadingItem} onPasteText={vi.fn()} />);

		expect(screen.getByText("upload.txt")).toBeInTheDocument();
		expect(screen.getByText(/uploading/i)).toBeInTheDocument();
	});
});
