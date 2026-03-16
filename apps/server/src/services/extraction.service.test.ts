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

	it("throws ExtractionNotSupportedError for application/pdf", async () => {
		await expect(
			extractText("application/pdf", Buffer.from([0x25, 0x50, 0x44, 0x46])),
		).rejects.toThrow(ExtractionNotSupportedError);
	});

	it("throws ExtractionNotSupportedError for application/vnd...docx", async () => {
		await expect(
			extractText(
				"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
				Buffer.alloc(0),
			),
		).rejects.toThrow(ExtractionNotSupportedError);
	});

	it("treats unknown MIME as UTF-8 fallback", async () => {
		const out = await extractText("application/octet-stream", buf("raw"));
		expect(out).toBe("raw");
	});
});
