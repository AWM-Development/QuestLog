/**
 * MIME-aware text extraction from uploaded files.
 * text/plain and text/markdown: UTF-8 passthrough. PDF/DOCX: stubbed for later.
 */

import { ExtractionNotSupportedError } from "../lib/errors.js";

const TEXT_PLAIN = "text/plain";
const TEXT_MARKDOWN = "text/markdown";
const TEXT_MARKDOWN_ALT = "text/x-markdown";
const APPLICATION_PDF = "application/pdf";
const APPLICATION_DOCX =
	"application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/**
 * Extract plain text from a file buffer by MIME type.
 * Supports text/plain and text/markdown; PDF/DOCX throw ExtractionNotSupportedError.
 */
export async function extractText(
	mimeType: string,
	buffer: Buffer,
): Promise<string> {
	const normalized = mimeType.toLowerCase().split(";")[0]?.trim() ?? "";

	if (
		normalized === TEXT_PLAIN ||
		normalized === TEXT_MARKDOWN ||
		normalized === TEXT_MARKDOWN_ALT
	) {
		return buffer.toString("utf-8");
	}

	if (normalized === APPLICATION_PDF || normalized === APPLICATION_DOCX) {
		throw new ExtractionNotSupportedError(mimeType);
	}

	// Fallback: treat as UTF-8 text (e.g. for .md/.txt with wrong MIME)
	return buffer.toString("utf-8");
}
