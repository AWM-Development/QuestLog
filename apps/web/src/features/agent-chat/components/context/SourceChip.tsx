import { Chip } from "../../../../components/buttons/Chip.js";
import type { MessageSource } from "../../types.js";

interface SourceChipProps {
	source: MessageSource;
	onClick?: () => void;
}

function getSourceType(sourceName: string): "document" | "session" | "entity" {
	const lower = sourceName.toLowerCase();
	if (
		lower.includes(".pdf") ||
		lower.includes(".md") ||
		lower.includes(".txt") ||
		lower.includes(".docx")
	) {
		return "document";
	}
	if (lower.includes("session")) {
		return "session";
	}
	return "entity";
}

const icons: Record<string, string> = {
	document: "\u{1F4C4}",
	session: "\u{1F4CB}",
	entity: "\u{1F9E9}",
};

export function SourceChip({ source, onClick }: SourceChipProps) {
	const type = getSourceType(source.sourceName);
	const icon = icons[type];

	return (
		<Chip
			variant="source"
			sourceType={type}
			as="button"
			tabIndex={0}
			onClick={onClick}
		>
			{icon} {source.sourceName}
		</Chip>
	);
}
