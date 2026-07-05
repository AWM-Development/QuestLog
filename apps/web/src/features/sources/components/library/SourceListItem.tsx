import type { Source } from "../../types.js";

interface SourceListItemProps {
	source: Source;
}

export function SourceListItem({ source }: SourceListItemProps) {
	const pageCount =
		typeof source.metadata?.pageCount === "number"
			? source.metadata.pageCount
			: null;

	const importedDate = source.createdAt.toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
	});

	return (
		<div
			style={{
				display: "flex",
				alignItems: "center",
				gap: "var(--space-3)",
				padding: "var(--space-3) var(--space-4)",
				borderRadius: "var(--r-md)",
				transition: "background-color 0.15s",
				cursor: "default",
			}}
			onMouseEnter={(e) => {
				(e.currentTarget as HTMLDivElement).style.backgroundColor =
					"var(--bg-focal)";
			}}
			onMouseLeave={(e) => {
				(e.currentTarget as HTMLDivElement).style.backgroundColor = "";
			}}
		>
			{/* Success dot */}
			<div
				aria-label="Imported"
				style={{
					width: 8,
					height: 8,
					borderRadius: "50%",
					backgroundColor: "var(--status-success)",
					flexShrink: 0,
				}}
			/>

			<div style={{ flex: 1, minWidth: 0 }}>
				<p
					style={{
						fontFamily: "var(--font-display)",
						fontSize: "15px",
						fontWeight: 600,
						color: "var(--text-primary)",
						overflow: "hidden",
						textOverflow: "ellipsis",
						whiteSpace: "nowrap",
					}}
				>
					{source.name}
				</p>
				<p style={{ fontSize: "12px", color: "var(--text-muted)" }}>
					{pageCount != null ? `${pageCount} pages · ` : ""}
					imported {importedDate}
				</p>
			</div>
		</div>
	);
}
