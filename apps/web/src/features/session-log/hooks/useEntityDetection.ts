import { useCallback, useEffect, useRef, useState } from "react";
import { trpc } from "../../../lib/trpc.js";
import type { EntitySpan } from "../types.js";

const DEBOUNCE_MS = 500;

export interface UseEntityDetectionOptions {
	campaignId: string;
	dismissedEntityTexts: string[];
}

export interface UseEntityDetectionReturn {
	detectedSpans: EntitySpan[];
	unresolvedCount: number;
	onEditorUpdate: (text: string, from: number, to: number) => void;
}

export function useEntityDetection({
	campaignId,
	dismissedEntityTexts,
}: UseEntityDetectionOptions): UseEntityDetectionReturn {
	const [detectedSpans, setDetectedSpans] = useState<EntitySpan[]>([]);
	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const [queryInput, setQueryInput] = useState<{
		text: string;
		from: number;
		to: number;
	} | null>(null);

	const dismissedRef = useRef(dismissedEntityTexts);
	dismissedRef.current = dismissedEntityTexts;

	const { data: rawSpans } = trpc.entity.detectSpans.useQuery(
		{
			campaignId,
			text: queryInput?.text ?? "",
			dismissedEntityTexts: dismissedRef.current,
		},
		{
			enabled: !!queryInput?.text,
		},
	);

	useEffect(() => {
		if (!rawSpans || !queryInput) return;
		const spans: EntitySpan[] = rawSpans.map((s) => ({
			entityId: s.entityId,
			entityName: s.entityName,
			entityType: s.entityType as EntitySpan["entityType"],
			startIndex: s.startIndex,
			endIndex: s.endIndex,
			matchType: s.matchType,
			candidates: s.candidates,
		}));

		setDetectedSpans((prev) => {
			// Merge: replace spans from the re-scanned range, keep others
			const others = prev.filter(
				(s) =>
					s.startIndex >= (queryInput?.to ?? 0) ||
					s.endIndex <= (queryInput?.from ?? 0),
			);
			return [...others, ...spans].sort(
				(a, b) => a.startIndex - b.startIndex,
			);
		});
	}, [rawSpans, queryInput]);

	const onEditorUpdate = useCallback((text: string, from: number, to: number) => {
		if (timerRef.current) {
			clearTimeout(timerRef.current);
		}
		timerRef.current = setTimeout(() => {
			timerRef.current = null;
			setQueryInput({ text, from, to });
		}, DEBOUNCE_MS);
	}, []);

	useEffect(() => {
		return () => {
			if (timerRef.current) clearTimeout(timerRef.current);
		};
	}, []);

	const unresolvedCount = detectedSpans.filter(
		(s) => s.matchType === "ambiguous" || s.matchType === "unlinked",
	).length;

	return { detectedSpans, unresolvedCount, onEditorUpdate };
}
