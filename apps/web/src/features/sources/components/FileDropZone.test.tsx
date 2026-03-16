import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { FileDropZone } from "./FileDropZone.js";

function renderDropZone(onFilesSelected = vi.fn()) {
	return render(<FileDropZone onFilesSelected={onFilesSelected} />);
}

describe("FileDropZone", () => {
	it("renders drop zone text", () => {
		renderDropZone();
		expect(screen.getByText("Drop files here")).toBeInTheDocument();
		expect(screen.getByText("or click to browse")).toBeInTheDocument();
		expect(
			screen.getByText(/PDF.*MD.*TXT.*DOCX.*50 MB/i),
		).toBeInTheDocument();
	});

	it("calls onFilesSelected when files are dropped", () => {
		const onFilesSelected = vi.fn();
		renderDropZone(onFilesSelected);

		const file = new File(["content"], "notes.txt", { type: "text/plain" });
		const dropZone = screen.getByRole("button");

		fireEvent.drop(dropZone, {
			dataTransfer: { files: [file], types: ["Files"] },
		});

		expect(onFilesSelected).toHaveBeenCalledWith([file]);
	});

	it("calls onFilesSelected when files are selected via input click", async () => {
		const onFilesSelected = vi.fn();
		renderDropZone(onFilesSelected);

		const file = new File(["content"], "notes.md", { type: "text/markdown" });
		const input = document.querySelector('input[type="file"]') as HTMLInputElement;

		await userEvent.upload(input, file);

		expect(onFilesSelected).toHaveBeenCalledWith([file]);
	});

	it("applies hover styling during drag over", () => {
		renderDropZone();
		const dropZone = screen.getByRole("button");

		fireEvent.dragOver(dropZone, {
			dataTransfer: { types: ["Files"] },
		});

		// The component should have a data-dragging attribute or changed style
		expect(dropZone).toHaveAttribute("data-dragging", "true");
	});

	it("removes hover styling on drag leave", () => {
		renderDropZone();
		const dropZone = screen.getByRole("button");

		fireEvent.dragOver(dropZone, { dataTransfer: { types: ["Files"] } });
		fireEvent.dragLeave(dropZone);

		expect(dropZone).toHaveAttribute("data-dragging", "false");
	});
});
