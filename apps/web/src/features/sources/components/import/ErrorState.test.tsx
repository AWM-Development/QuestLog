import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Source } from "../../types.js";
import { ErrorState } from "./ErrorState.js";

const errorSource: Source = {
	id: "00000000-0000-0000-0000-000000000001",
	campaignId: "00000000-0000-0000-0000-000000000002",
	name: "scanned-module.pdf",
	type: "pdf",
	mimeType: "application/pdf",
	sizeBytes: 4000000,
	hash: "abc",
	status: "error",
	metadata: {},
	createdAt: new Date(),
	updatedAt: new Date(),
};

const scannedPdfSource: Source = {
	...errorSource,
	metadata: { errorReason: "scanned_pdf" },
};

describe("ErrorState", () => {
	it("renders rescan guidance when errorReason is scanned_pdf", () => {
		render(
			<ErrorState
				source={scannedPdfSource}
				onPasteText={vi.fn()}
				onDismiss={vi.fn()}
			/>,
		);
		expect(screen.getByText(/Google Drive, Apple Notes/i)).toBeInTheDocument();
	});

	it("renders generic PDF error when no errorReason", () => {
		render(
			<ErrorState
				source={errorSource}
				onPasteText={vi.fn()}
				onDismiss={vi.fn()}
			/>,
		);
		expect(screen.getByText(/could not be processed/i)).toBeInTheDocument();
	});

	it("renders custom error message when provided", () => {
		render(
			<ErrorState
				source={errorSource}
				errorMessage="Custom extraction error"
				onPasteText={vi.fn()}
				onDismiss={vi.fn()}
			/>,
		);
		expect(screen.getByText("Custom extraction error")).toBeInTheDocument();
	});

	it("calls onPasteText with source name when 'Paste text instead' clicked", async () => {
		const onPasteText = vi.fn();
		render(
			<ErrorState
				source={errorSource}
				onPasteText={onPasteText}
				onDismiss={vi.fn()}
			/>,
		);

		await userEvent.click(
			screen.getByRole("button", { name: /paste text instead/i }),
		);
		expect(onPasteText).toHaveBeenCalledWith("scanned-module.pdf");
	});

	it("calls onDismiss when Dismiss clicked", async () => {
		const onDismiss = vi.fn();
		render(
			<ErrorState
				source={errorSource}
				onPasteText={vi.fn()}
				onDismiss={onDismiss}
			/>,
		);

		await userEvent.click(screen.getByRole("button", { name: /dismiss/i }));
		expect(onDismiss).toHaveBeenCalled();
	});
});
