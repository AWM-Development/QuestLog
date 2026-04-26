import type { Editor } from "@tiptap/core";
import { useCallback, useEffect, useRef, useState } from "react";
import { trpc } from "../../../lib/trpc.js";
import type { EntitySpan, EntityType } from "../types.js";

const DEBOUNCE_MS = 500;

export interface UseEntityDetectionOptions {
	editor: Editor | null;
	campaignId: string;
	dismissedRef: React.MutableRefObject<string[]>;
}

export interface UseEntityDetectionReturn {
	detectedSpans: EntitySpan[];
	unresolvedCount: number;
	scanParagraph: (paragraphPos: number) => void;
	scanFullDocument: () => void;
}

/**
 * Walk the doc and extract all entityHighlight marks as EntitySpans.
 * Indices are PM positions (not text offsets).
 */
function collectMarkSpans(editor: Editor): EntitySpan[] {
	const spans: EntitySpan[] = [];
	const markType = editor.schema.marks.entityHighlight;
	if (!markType) return spans;

	editor.state.doc.descendants((node, pos) => {
		if (!node.isText) return;
		const mark = node.marks.find((m) => m.type === markType);
		if (!mark) return;
		const attrs = mark.attrs as {
			entityId: string | null;
			entityType: string | null;
			state: "confirmed" | "ambiguous" | "unlinked";
			candidates: string;
		};
		let candidates: { id: string; name: string }[] = [];
		try {
			candidates = JSON.parse(attrs.candidates ?? "[]");
		} catch {
			candidates = [];
		}
		spans.push({
			entityId: attrs.entityId ?? "",
			entityName: node.text ?? "",
			entityType: (attrs.entityType ?? "npc") as EntityType,
			startIndex: pos,
			endIndex: pos + node.nodeSize,
			matchType: attrs.state,
			candidates,
		});
	});
	return spans;
}

/**
 * Iterate top-level paragraphs (and any block with text content) in the doc,
 * yielding their PM range and text.
 */
function forEachParagraph(
	editor: Editor,
	cb: (info: { from: number; to: number; text: string }) => void,
): void {
	editor.state.doc.descendants((node, pos) => {
		if (!node.isTextblock) return;
		const text = node.textContent;
		if (!text) {
			// Still need to descend? Textblocks are leaf-ish for our purposes.
			return false;
		}
		// Inner content range: pos+1 .. pos+1+text.length
		cb({ from: pos + 1, to: pos + 1 + text.length, text });
		return false; // textblocks contain only inline content; no need to descend further
	});
}

export function useEntityDetection({
	editor,
	campaignId,
	dismissedRef,
}: UseEntityDetectionOptions): UseEntityDetectionReturn {
	const [detectedSpans, setDetectedSpans] = useState<EntitySpan[]>([]);
	const utils = trpc.useUtils();
	const timersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(
		new Map(),
	);
	const editorRef = useRef(editor);
	editorRef.current = editor;

	const refreshDetectedSpans = useCallback(() => {
		const ed = editorRef.current;
		if (!ed) return;
		setDetectedSpans(collectMarkSpans(ed));
	}, []);

	const runScan = useCallback(
		async (paragraphPos: number) => {
			const ed = editorRef.current;
			if (!ed) return;

			// Re-resolve the paragraph at this position; the doc may have
			// shifted since the scan was scheduled.
			const $pos = ed.state.doc.resolve(
				Math.min(paragraphPos, ed.state.doc.content.size),
			);
			const block = $pos.parent;
			if (!block.isTextblock) return;
			const blockStart = $pos.start();
			const text = block.textContent;
			const blockEnd = blockStart + text.length;

			if (!text.trim()) {
				// Empty paragraph: just clear marks in the range.
				ed.commands.setEntitySpans([], blockStart, blockEnd);
				refreshDetectedSpans();
				return;
			}

			let serverSpans: Array<{
				entityId: string;
				entityName: string;
				entityType: string;
				startIndex: number;
				endIndex: number;
				matchType: "confirmed" | "ambiguous";
				candidates: { id: string; name: string }[];
			}> = [];
			try {
				serverSpans = await utils.entity.detectSpans.fetch({
					campaignId,
					text,
					dismissedEntityTexts: dismissedRef.current,
				});
			} catch {
				return;
			}

			const pmSpans = serverSpans.map((s) => ({
				entityId: s.entityId,
				entityName: s.entityName,
				entityType: s.entityType,
				// Convert paragraph-local text offsets → PM positions, but the
				// command itself adds paragraphFrom; setEntitySpans expects
				// startIndex/endIndex relative to the paragraph start. Keep
				// text-offset semantics here.
				startIndex: s.startIndex,
				endIndex: s.endIndex,
				matchType: s.matchType,
				candidates: s.candidates,
			}));

			ed.commands.setEntitySpans(pmSpans, blockStart, blockEnd);
			refreshDetectedSpans();
		},
		[campaignId, dismissedRef, refreshDetectedSpans, utils.entity.detectSpans],
	);

	const scanParagraph = useCallback(
		(paragraphPos: number) => {
			const timers = timersRef.current;
			const existing = timers.get(paragraphPos);
			if (existing) clearTimeout(existing);
			const t = setTimeout(() => {
				timers.delete(paragraphPos);
				void runScan(paragraphPos);
			}, DEBOUNCE_MS);
			timers.set(paragraphPos, t);
		},
		[runScan],
	);

	const scanFullDocument = useCallback(() => {
		const ed = editorRef.current;
		if (!ed) return;
		const positions: number[] = [];
		forEachParagraph(ed, ({ from }) => {
			positions.push(from);
		});
		// Run all scans without debounce on initial pass.
		void Promise.all(positions.map((pos) => runScan(pos))).then(() => {
			refreshDetectedSpans();
		});
	}, [refreshDetectedSpans, runScan]);

	// Cleanup timers on unmount.
	useEffect(() => {
		const timers = timersRef.current;
		return () => {
			for (const t of timers.values()) clearTimeout(t);
			timers.clear();
		};
	}, []);

	const unresolvedCount = detectedSpans.filter(
		(s) => s.matchType === "ambiguous" || s.matchType === "unlinked",
	).length;

	return { detectedSpans, unresolvedCount, scanParagraph, scanFullDocument };
}

/** Exposed for tests / callers that need fresh mark state. */
export { collectMarkSpans };
