interface EmberPlaceholderProps {
	/** Any status string — import pipeline stages, local queue states, or future values. */
	status: string;
}

/** Emoji placeholder for the Ember mascot. Replaced by sprite animation in Task 8.2. */
export function EmberPlaceholder({ status }: EmberPlaceholderProps) {
	const emoji = getEmoji(status);

	return (
		<div
			aria-label={`Ember: ${status}`}
			style={{
				width: 48,
				height: 48,
				border: "1px dashed var(--border)",
				borderRadius: "var(--r-sm)",
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				fontSize: "1.25rem",
				flexShrink: 0,
			}}
		>
			{emoji}
		</div>
	);
}

function getEmoji(status: string): string {
	switch (status) {
		case "pending":
		case "hashing":
		case "checking":
			return "💤";
		case "extracting":
		case "chunking":
		case "embedding":
		case "uploading":
			return "🐉 nom";
		case "error":
			return "😵";
		case "done":
			return "🎉";
		default:
			return "💤";
	}
}
