import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Source } from "../../types.js";
import { DuplicatePrompt } from "./DuplicatePrompt.js";

const existingSource: Source = {
	id: "00000000-0000-0000-0000-000000000001",
	campaignId: "00000000-0000-0000-0000-000000000002",
	name: "notes.txt",
	type: "text",
	mimeType: "text/plain",
	sizeBytes: 100,
	hash: "abc",
	status: "done",
	metadata: {},
	createdAt: new Date("2026-03-12T12:00:00"),
	updatedAt: new Date("2026-03-12T12:00:00"),
};

describe("DuplicatePrompt", () => {
	it("renders warning message with existing file date", () => {
		render(
			<DuplicatePrompt existingSource={existingSource} onResolve={vi.fn()} />,
		);
		expect(screen.getByText(/already imported/i)).toBeInTheDocument();
		// Date "Mar 12, 2026" should appear somewhere in the message
		expect(screen.getByText(/Mar 12/)).toBeInTheDocument();
	});

	it("calls onResolve with 'replace' when Replace clicked", async () => {
		const onResolve = vi.fn();
		render(
			<DuplicatePrompt existingSource={existingSource} onResolve={onResolve} />,
		);

		await userEvent.click(screen.getByRole("button", { name: /replace/i }));
		expect(onResolve).toHaveBeenCalledWith("replace");
	});

	it("calls onResolve with 'keep_both' when Keep both clicked", async () => {
		const onResolve = vi.fn();
		render(
			<DuplicatePrompt existingSource={existingSource} onResolve={onResolve} />,
		);

		await userEvent.click(screen.getByRole("button", { name: /keep both/i }));
		expect(onResolve).toHaveBeenCalledWith("keep_both");
	});

	it("calls onResolve with 'skip' when Skip clicked", async () => {
		const onResolve = vi.fn();
		render(
			<DuplicatePrompt existingSource={existingSource} onResolve={onResolve} />,
		);

		await userEvent.click(screen.getByRole("button", { name: /skip/i }));
		expect(onResolve).toHaveBeenCalledWith("skip");
	});
});
