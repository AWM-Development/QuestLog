import { describe, expect, it } from "vitest";
import { chunkText } from "./chunking.service.js";

describe("chunkText", () => {
	it("returns a single chunk for short text", () => {
		const chunks = chunkText("Hello world, this is a short text.", {
			sourceId: "s1",
			campaignId: "c1",
		});

		expect(chunks).toHaveLength(1);
		expect(chunks[0]?.content).toBe("Hello world, this is a short text.");
		expect(chunks[0]?.position).toBe(0);
		expect(chunks[0]?.sourceId).toBe("s1");
		expect(chunks[0]?.campaignId).toBe("c1");
	});

	it("splits long text into multiple chunks within word-count limits", () => {
		// Generate text with ~2000 words (should produce 2-3 chunks at 650-1000 word target)
		const words = Array.from({ length: 2000 }, (_, i) => `word${i}`);
		const text = words.join(" ");

		const chunks = chunkText(text, { sourceId: "s1", campaignId: "c1" });

		expect(chunks.length).toBeGreaterThanOrEqual(2);
		expect(chunks.length).toBeLessThanOrEqual(4);

		// No chunk should exceed max word count (1000 words)
		for (const chunk of chunks) {
			const wordCount = chunk.content.split(/\s+/).filter(Boolean).length;
			expect(wordCount).toBeLessThanOrEqual(1050); // small tolerance
		}

		// Positions should be sequential
		for (let i = 0; i < chunks.length; i++) {
			expect(chunks[i]?.position).toBe(i);
		}
	});

	it("respects heading boundaries for splitting", () => {
		const section1 = Array.from({ length: 500 }, (_, i) => `alpha${i}`).join(
			" ",
		);
		const section2 = Array.from({ length: 500 }, (_, i) => `beta${i}`).join(
			" ",
		);
		const text = `${section1}\n\n## Section Two\n\n${section2}`;

		const chunks = chunkText(text, { sourceId: "s1", campaignId: "c1" });

		expect(chunks.length).toBeGreaterThanOrEqual(2);

		// The second chunk should start with the heading
		const headingChunk = chunks.find((c) =>
			c.content.includes("## Section Two"),
		);
		expect(headingChunk).toBeDefined();
		expect(headingChunk?.content.trimStart().startsWith("## Section Two")).toBe(
			true,
		);
	});

	it("respects double-newline paragraph boundaries", () => {
		const para1 = Array.from({ length: 600 }, (_, i) => `para1w${i}`).join(" ");
		const para2 = Array.from({ length: 600 }, (_, i) => `para2w${i}`).join(" ");
		const text = `${para1}\n\n${para2}`;

		const chunks = chunkText(text, { sourceId: "s1", campaignId: "c1" });

		expect(chunks.length).toBeGreaterThanOrEqual(2);
		// First chunk should be from para1, second from para2
		expect(chunks[0]?.content).toContain("para1w0");
		expect(chunks[chunks.length - 1]?.content).toContain("para2w0");
	});

	it("handles empty text by returning an empty array", () => {
		const chunks = chunkText("", { sourceId: "s1", campaignId: "c1" });
		expect(chunks).toHaveLength(0);
	});

	it("handles whitespace-only text by returning an empty array", () => {
		const chunks = chunkText("   \n\n  ", { sourceId: "s1", campaignId: "c1" });
		expect(chunks).toHaveLength(0);
	});

	it("anchors chunks to a sessionId when passed instead of a sourceId", () => {
		const chunks = chunkText("The party arrived at the gates.", {
			sessionId: "sess-1",
			campaignId: "c1",
		});

		expect(chunks).toHaveLength(1);
		expect(chunks[0]?.sessionId).toBe("sess-1");
		expect(chunks[0]?.sourceId).toBeUndefined();
		expect(chunks[0]?.campaignId).toBe("c1");
	});

	it("does not exceed max chunk size even without natural boundaries", () => {
		// One giant paragraph with no headings or double-newlines
		const words = Array.from({ length: 1500 }, (_, i) => `word${i}`);
		const text = words.join(" ");

		const chunks = chunkText(text, { sourceId: "s1", campaignId: "c1" });

		expect(chunks.length).toBeGreaterThanOrEqual(2);
		for (const chunk of chunks) {
			const wordCount = chunk.content.split(/\s+/).filter(Boolean).length;
			expect(wordCount).toBeLessThanOrEqual(1050);
		}
	});
});
