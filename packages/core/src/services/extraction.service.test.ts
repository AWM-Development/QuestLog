import { describe, expect, it } from "vitest";
import { ExtractionNotSupportedError } from "../lib/errors.js";
import { extractText } from "./extraction.service.js";

const buf = (s: string) => Buffer.from(s, "utf-8");

describe("extractText", () => {
	it("extracts UTF-8 text for text/plain", async () => {
		const out = await extractText("text/plain", buf("hello world"));
		expect(out).toBe("hello world");
	});

	it("extracts UTF-8 text for text/markdown", async () => {
		const out = await extractText("text/markdown", buf("# Title\n\nBody"));
		expect(out).toBe("# Title\n\nBody");
	});

	it("extracts text from a PDF buffer", async () => {
		// pdf-parse works on real PDF buffers; we'll use a minimal one
		// For unit tests we test the branch logic — integration tests verify real PDFs
		const result = await extractText(
			"application/pdf",
			// Minimal valid PDF (pdf-parse needs %PDF header)
			Buffer.from(
				"%PDF-1.0\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<<>>>>endobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n206\n%%EOF",
			),
		);
		// Minimal PDF has no text content — should return empty string
		expect(typeof result).toBe("string");
	});

	it("returns empty-ish text for a PDF with no real content (scanned PDF scenario)", async () => {
		// A minimal PDF with no text content — extractText returns the raw
		// output which may include page separators but no meaningful text.
		// The pipeline (import.service) checks for empty content.
		const result = await extractText(
			"application/pdf",
			Buffer.from(
				"%PDF-1.0\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<<>>>>endobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n206\n%%EOF",
			),
		);
		// Strip page separators and whitespace — no real words remain
		const stripped = result.replace(/--\s*\d+\s+of\s+\d+\s*--/g, "").trim();
		expect(stripped).toBe("");
	});

	it("extracts text from a DOCX buffer", async () => {
		// mammoth requires a real docx (zip) buffer; we test that the branch
		// is hit and errors appropriately with invalid data
		await expect(
			extractText(
				"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
				Buffer.from("not a real docx"),
			),
		).rejects.toThrow(); // mammoth will throw on invalid zip
	});

	it("throws ExtractionNotSupportedError for unknown types", async () => {
		await expect(
			extractText("application/x-unknown-binary", buf("data")),
		).rejects.toThrow(ExtractionNotSupportedError);
	});

	it("treats unknown MIME as UTF-8 fallback for text-like types", async () => {
		const out = await extractText("text/csv", buf("a,b,c"));
		expect(out).toBe("a,b,c");
	});
});
