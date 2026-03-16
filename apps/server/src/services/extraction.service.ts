/**
 * MIME-aware text extraction from uploaded files.
 * text/plain, text/markdown, text/*: UTF-8 passthrough.
 * PDF: pdf-parse. DOCX: mammoth.
 */

import { ExtractionNotSupportedError } from "../lib/errors.js";

const APPLICATION_PDF = "application/pdf";
const APPLICATION_DOCX =
	"application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/**
 * Extract plain text from a file buffer by MIME type.
 * Supports text/*, application/pdf, and DOCX.
 * Throws ExtractionNotSupportedError for unsupported binary types.
 */
export async function extractText(
	mimeType: string,
	buffer: Buffer,
): Promise<string> {
	const normalized = mimeType.toLowerCase().split(";")[0]?.trim() ?? "";

	// Text types: passthrough as UTF-8
	if (normalized.startsWith("text/")) {
		return buffer.toString("utf-8");
	}

	// PDF extraction via pdf-parse
	if (normalized === APPLICATION_PDF) {
		const { PDFParse } = await import("pdf-parse");
		const parser = new PDFParse(new Uint8Array(buffer));
		const result = await parser.getText();
		parser.destroy();
		return result.text;
	}

	// DOCX extraction via mammoth
	if (normalized === APPLICATION_DOCX) {
		const mammoth = await import("mammoth");
		const result = await mammoth.extractRawText({ buffer });
		return result.value;
	}

	throw new ExtractionNotSupportedError(mimeType);
}
