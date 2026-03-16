import type {
	DuplicateResolutionAction,
	LocalQueueItem,
	Source,
} from "../types.js";
import { ImportQueueItem } from "./ImportQueueItem.js";

interface ImportQueueProps {
	localItems: LocalQueueItem[];
	activeSources: Source[];
	onResolveDuplicate: (
		item: LocalQueueItem,
		action: DuplicateResolutionAction,
	) => void;
	onPasteText: (fileName: string) => void;
}

export function ImportQueue({
	localItems,
	activeSources,
	onResolveDuplicate,
	onPasteText,
}: ImportQueueProps) {
	return (
		<div
			style={{
				display: "flex",
				flexDirection: "column",
				gap: "var(--space-3)",
			}}
		>
			{localItems.map((item) => (
				<ImportQueueItem
					key={item.key}
					localItem={item}
					onResolveDuplicate={(action) => onResolveDuplicate(item, action)}
					onPasteText={onPasteText}
				/>
			))}
			{activeSources.map((source) => (
				<ImportQueueItem
					key={source.id}
					source={source}
					onPasteText={onPasteText}
				/>
			))}
		</div>
	);
}
