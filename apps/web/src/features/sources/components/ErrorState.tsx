import { Alert } from "@/components/Alert.js";
import { Button } from "@/components/Button.js";
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
	const errorReason = source.metadata?.errorReason;
	const message =
		errorMessage ??
		(errorReason === "scanned_pdf"
			? "This PDF is a scanned image with no text layer. Re-scan using Google Drive, Apple Notes, or Microsoft Lens — these apps create searchable PDFs automatically."
			: source.mimeType === "application/pdf"
				? "This PDF could not be processed. Try re-uploading or converting to a different format."
				: "Text extraction failed.");

	return (
		<Alert
			variant="error"
			layout="inline"
			style={{ marginTop: "var(--space-3)" }}
		>
			<p style={{ fontSize: "0.8125rem", marginBottom: "var(--space-3)" }}>
				{message}
			</p>
			<div style={{ display: "flex", gap: "var(--space-2)" }}>
				<Button
					variant="ghost"
					onClick={() => onPasteText(source.name)}
					style={{ color: "var(--accent)", fontSize: "0.8125rem" }}
				>
					Paste text instead
				</Button>
				<Button
					variant="ghost"
					onClick={onDismiss}
					style={{ fontSize: "0.8125rem" }}
				>
					Dismiss
				</Button>
			</div>
		</Alert>
	);
}
