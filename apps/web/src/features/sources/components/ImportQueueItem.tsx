import type {
	DuplicateResolutionAction,
	LocalQueueItem,
	Source,
} from "../types.js";
import { DuplicatePrompt } from "./DuplicatePrompt.js";
import { EmberPlaceholder } from "./EmberPlaceholder.js";
import { ErrorState } from "./ErrorState.js";

interface ImportQueueItemProps {
	source?: Source;
	localItem?: LocalQueueItem;
	onResolveDuplicate?: (action: DuplicateResolutionAction) => void;
	onPasteText: (fileName: string) => void;
}

const STATUS_PROGRESS: Record<string, number> = {
	pending: 10,
	hashing: 5,
	checking: 8,
	uploading: 20,
	"waiting-duplicate": 0,
	extracting: 35,
	chunking: 60,
	embedding: 85,
	done: 100,
	error: 100,
};

function getStatus(source?: Source, localItem?: LocalQueueItem): string {
	if (localItem) return localItem.state;
	if (source) return source.status;
	return "pending";
}

function getName(source?: Source, localItem?: LocalQueueItem): string {
	if (localItem) return localItem.file.name;
	if (source) return source.name;
	return "Unknown file";
}

export function ImportQueueItem({
	source,
	localItem,
	onResolveDuplicate,
	onPasteText,
}: ImportQueueItemProps) {
	const status = getStatus(source, localItem);
	const name = getName(source, localItem);
	const progress = STATUS_PROGRESS[status] ?? 10;
	const isError = status === "error";
	const isDuplicate = status === "waiting-duplicate";

	const progressColor = isError ? "var(--status-error)" : "var(--accent)";

	return (
		<div
			style={{
				backgroundColor: "var(--bg-surface)",
				border: `1px solid ${
					isError
						? "var(--status-error)"
						: isDuplicate
							? "var(--status-warning)"
							: "var(--border-subtle)"
				}`,
				borderRadius: "var(--r-md)",
				padding: "var(--space-4)",
			}}
		>
			<div
				style={{
					display: "flex",
					alignItems: "flex-start",
					gap: "var(--space-4)",
				}}
			>
				<div style={{ flex: 1, minWidth: 0 }}>
					<p
						style={{
							fontFamily: "var(--font-display)",
							fontSize: "0.9375rem",
							fontWeight: 600,
							color: "var(--text-primary)",
							marginBottom: "var(--space-1)",
							overflow: "hidden",
							textOverflow: "ellipsis",
							whiteSpace: "nowrap",
						}}
					>
						{name}
					</p>
					<p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)" }}>
						{getStatusLabel(status)}
					</p>

					{/* Progress bar */}
					{!isDuplicate && (
						<div
							aria-label={`Progress: ${progress}%`}
							style={{
								marginTop: "var(--space-3)",
								height: 4,
								borderRadius: 2,
								backgroundColor: "var(--border-subtle)",
								overflow: "hidden",
							}}
						>
							<div
								style={{
									height: "100%",
									width: `${progress}%`,
									borderRadius: 2,
									backgroundColor: progressColor,
									transition: "width 0.4s ease",
								}}
							/>
						</div>
					)}
				</div>

				<EmberPlaceholder
					status={status as Parameters<typeof EmberPlaceholder>[0]["status"]}
				/>
			</div>

			{/* Inline duplicate resolution */}
			{isDuplicate && localItem?.existingSource && onResolveDuplicate && (
				<DuplicatePrompt
					existingSource={localItem.existingSource}
					onResolve={onResolveDuplicate}
				/>
			)}

			{/* Inline error with fallback */}
			{isError && source && (
				<ErrorState
					source={source}
					onPasteText={onPasteText}
					onDismiss={() => {
						/* TODO: dismiss logic (remove from active list) */
					}}
				/>
			)}
		</div>
	);
}

function getStatusLabel(status: string): string {
	switch (status) {
		case "hashing":
			return "Computing checksum…";
		case "checking":
			return "Checking for duplicates…";
		case "uploading":
			return "Uploading…";
		case "waiting-duplicate":
			return "Duplicate detected";
		case "pending":
			return "Queued";
		case "extracting":
			return "Extracting text…";
		case "chunking":
			return "Splitting into chunks…";
		case "embedding":
			return "Generating embeddings…";
		case "done":
			return "Done";
		case "error":
			return "Failed";
		default:
			return status;
	}
}
