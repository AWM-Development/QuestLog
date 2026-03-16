import type { Source } from "../types.js";
import { SourceListItem } from "./SourceListItem.js";

interface SourceListProps {
	sources: Source[];
}

export function SourceList({ sources }: SourceListProps) {
	if (sources.length === 0) return null;

	return (
		<div
			style={{
				backgroundColor: "var(--bg-elevated)",
				borderRadius: "var(--r-md)",
				border: "1px solid var(--border-subtle)",
				overflow: "hidden",
			}}
		>
			{sources.map((source, index) => (
				<div
					key={source.id}
					style={{
						borderBottom:
							index < sources.length - 1 ? "1px solid var(--border-subtle)" : "none",
					}}
				>
					<SourceListItem source={source} />
				</div>
			))}
		</div>
	);
}
