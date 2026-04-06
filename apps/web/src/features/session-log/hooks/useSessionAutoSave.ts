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

	const scheduleSave = useCallback(
		(contentJson: string) => {
			if (contentJson === lastSavedRef.current) {
				return;
			}
			setSaveState({ kind: "pending" });
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

	useEffect(() => {
		return () => {
			if (timerRef.current) clearTimeout(timerRef.current);
		};
	}, []);

	return { saveState, scheduleSave, lastSavedRef };
}
