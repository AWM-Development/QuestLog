import { type CSSProperties, useEffect, useState } from "react";
import { saveStatusText } from "../../../components/styles.js";
import type { SaveState } from "../hooks/useSessionAutoSave.js";

function formatRelative(when: Date): string {
	const s = Math.floor((Date.now() - when.getTime()) / 1000);
	if (s < 5) return "just now";
	if (s < 60) return `${s}s ago`;
	const m = Math.floor(s / 60);
	if (m < 60) return `${m}m ago`;
	return when.toLocaleString();
}

interface SaveStatusProps {
	saveState: SaveState;
}

const pulseStyle: CSSProperties = {
	animation: "save-pulse 1s ease-in-out infinite",
};

export function SaveStatus({ saveState }: SaveStatusProps) {
	const [tick, setTick] = useState(0);

	useEffect(() => {
		if (saveState.kind !== "saved") return;
		const id = window.setInterval(() => setTick((t) => t + 1), 1000);
		return () => clearInterval(id);
	}, [saveState]);

	let label = "Unsaved changes";
	if (saveState.kind === "pending") label = "Unsaved changes";
	if (saveState.kind === "saving") label = "Saving...";
	if (saveState.kind === "saved") {
		label = `Saved · ${formatRelative(saveState.at)}`;
	}
	if (saveState.kind === "error") {
		return (
			<div
				style={{
					...saveStatusText,
					color: "var(--status-error)",
					...(saveState.kind === "error" ? pulseStyle : {}),
				}}
			>
				{saveState.message}
			</div>
		);
	}

	return (
		<div
			style={{
				...saveStatusText,
				...(saveState.kind === "saving" ? pulseStyle : {}),
			}}
		>
			{label}
			{/* tick forces re-render for relative time */}
			<span style={{ display: "none" }}>{tick}</span>
		</div>
	);
}
