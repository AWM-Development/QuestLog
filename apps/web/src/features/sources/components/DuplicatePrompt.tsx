import { Button } from "@/components/Button.js";
import { Alert } from "@/components/feedback/Alert.js";
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
		<Alert
			variant="warning"
			layout="inline"
			style={{ marginTop: "var(--space-3)" }}
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
				<Button
					variant="ghost"
					onClick={() => onResolve("replace")}
					style={{ color: "var(--status-warning)", fontSize: "0.8125rem" }}
				>
					Replace
				</Button>
				<Button
					variant="ghost"
					onClick={() => onResolve("keep_both")}
					style={{ fontSize: "0.8125rem" }}
				>
					Keep both
				</Button>
				<Button
					variant="ghost"
					onClick={() => onResolve("skip")}
					style={{ fontSize: "0.8125rem" }}
				>
					Skip
				</Button>
			</div>
		</Alert>
	);
}
