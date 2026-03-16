import { buttonGhost } from "@/components/styles.js";
import type { Source } from "../types.js";

interface ErrorStateProps {
	source: Source;
	errorMessage?: string;
	onPasteText: (fileName: string) => void;
	onDismiss: () => void;
}

export function ErrorState({
	source,
	errorMessage,
	onPasteText,
	onDismiss,
}: ErrorStateProps) {
	const message =
		errorMessage ??
		(source.mimeType === "application/pdf"
			? "This PDF appears to be a scanned image — text extraction failed."
			: "Text extraction failed.");

	return (
		<div
			style={{
				marginTop: "var(--space-3)",
				padding: "var(--space-3) var(--space-4)",
				border: "1px solid var(--status-error)",
				borderRadius: "var(--r-sm)",
				backgroundColor: "rgba(220, 96, 96, 0.06)",
			}}
		>
			<p style={{ fontSize: "0.8125rem", color: "var(--status-error)", marginBottom: "var(--space-3)" }}>
				{message}
			</p>
			<div style={{ display: "flex", gap: "var(--space-2)" }}>
				<button
					type="button"
					onClick={() => onPasteText(source.name)}
					style={{ ...buttonGhost, color: "var(--accent)", fontSize: "0.8125rem" }}
				>
					Paste text instead
				</button>
				<button
					type="button"
					onClick={onDismiss}
					style={{ ...buttonGhost, fontSize: "0.8125rem" }}
				>
					Dismiss
				</button>
			</div>
		</div>
	);
}
