import { useCallback, useEffect, useRef, useState } from "react";

const DEBOUNCE_MS = 2000;

export type SaveState =
	| { kind: "idle" }
	| { kind: "pending" }
	| { kind: "saving" }
	| { kind: "saved"; at: Date }
	| { kind: "error"; message: string };

export function useSessionAutoSave(
	saveFn: (contentJson: string) => Promise<void>,
) {
	const [saveState, setSaveState] = useState<SaveState>({ kind: "idle" });
	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const lastSavedRef = useRef<string | null>(null);
	const pendingContentRef = useRef<string | null>(null);

	const scheduleSave = useCallback(
		(contentJson: string) => {
			if (contentJson === lastSavedRef.current) {
				return;
			}
			setSaveState({ kind: "pending" });
			pendingContentRef.current = contentJson;
			if (timerRef.current) {
				clearTimeout(timerRef.current);
			}
			timerRef.current = setTimeout(async () => {
				timerRef.current = null;
				setSaveState({ kind: "saving" });
				try {
					await saveFn(contentJson);
					lastSavedRef.current = contentJson;
					setSaveState({ kind: "saved", at: new Date() });
				} catch {
					setSaveState({
						kind: "error",
						message: "Save failed — retrying...",
					});
				}
			}, DEBOUNCE_MS);
		},
		[saveFn],
	);

	/** Cancel the pending debounce timer and immediately invoke saveFn with the last scheduled content. */
	const flushSave = useCallback(() => {
		if (timerRef.current) {
			clearTimeout(timerRef.current);
			timerRef.current = null;
		}
		const content = pendingContentRef.current;
		if (content !== null && content !== lastSavedRef.current) {
			setSaveState({ kind: "saving" });
			void saveFn(content).then(
				() => {
					lastSavedRef.current = content;
					setSaveState({ kind: "saved", at: new Date() });
				},
				() => {
					setSaveState({
						kind: "error",
						message: "Save failed — retrying...",
					});
				},
			);
		}
	}, [saveFn]);

	useEffect(() => {
		return () => {
			if (timerRef.current) clearTimeout(timerRef.current);
		};
	}, []);

	return { saveState, scheduleSave, flushSave };
}
