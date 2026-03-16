import { buttonGhost, inlineAlertWarning } from "@/components/styles.js";
import type { DuplicateResolutionAction, Source } from "../types.js";

interface DuplicatePromptProps {
	existingSource: Source;
	onResolve: (action: DuplicateResolutionAction) => void;
}

export function DuplicatePrompt({
	existingSource,
	onResolve,
}: DuplicatePromptProps) {
	const importedDate = existingSource.createdAt.toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	});

	return (
		<div
			style={{
				...inlineAlertWarning,
				marginTop: "var(--space-3)",
			}}
		>
			<p
				style={{
					fontSize: "0.8125rem",
					color: "var(--text-secondary)",
					marginBottom: "var(--space-3)",
				}}
			>
				This looks like a file you already imported ({importedDate}). What
				should we do?
			</p>
			<div style={{ display: "flex", gap: "var(--space-2)" }}>
				<button
					type="button"
					onClick={() => onResolve("replace")}
					style={{
						...buttonGhost,
						color: "var(--status-warning)",
						fontSize: "0.8125rem",
					}}
				>
					Replace
				</button>
				<button
					type="button"
					onClick={() => onResolve("keep_both")}
					style={{ ...buttonGhost, fontSize: "0.8125rem" }}
				>
					Keep both
				</button>
				<button
					type="button"
					onClick={() => onResolve("skip")}
					style={{ ...buttonGhost, fontSize: "0.8125rem" }}
				>
					Skip
				</button>
			</div>
		</div>
	);
}
