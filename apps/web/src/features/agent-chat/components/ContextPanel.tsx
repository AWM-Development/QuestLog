import type { CSSProperties } from "react";
import {
	entityAvatarColors,
	panelSection,
	panelSectionTitle,
} from "../../../components/styles.js";
import type { MessageSource } from "../types.js";

interface ContextPanelProps {
	sources: MessageSource[];
}

const panelStyle: CSSProperties = {
	width: 300,
	background: "var(--bg-surface)",
	borderLeft: "0.5px solid var(--border)",
	display: "flex",
	flexDirection: "column",
	height: "100%",
	overflow: "auto",
	flexShrink: 0,
};

const entityRowStyle: CSSProperties = {
	display: "flex",
	alignItems: "center",
	gap: "10px",
	padding: "6px 0",
};

const avatarStyle: CSSProperties = {
	width: 28,
	height: 28,
	borderRadius: "var(--r-md)",
	display: "flex",
	alignItems: "center",
	justifyContent: "center",
	fontSize: "12px",
	fontWeight: 600,
	flexShrink: 0,
};

const entityNameStyle: CSSProperties = {
	fontSize: "12px",
	fontWeight: 500,
	color: "var(--text-primary)",
};

const entityTypeStyle: CSSProperties = {
	fontSize: "10px",
	opacity: 0.5,
};

function guessEntityType(sourceName: string): keyof typeof entityAvatarColors {
	const lower = sourceName.toLowerCase();
	if (lower.includes("session")) return "faction";
	if (lower.includes(".pdf") || lower.includes(".md") || lower.includes(".txt"))
		return "npc";
	if (lower.includes("location") || lower.includes("place")) return "location";
	if (lower.includes("item") || lower.includes("artifact")) return "item";
	return "story_arc";
}

export function ContextPanel({ sources }: ContextPanelProps) {
	// Deduplicate sources by sourceId
	const uniqueSources = Array.from(
		new Map(sources.map((s) => [s.sourceId, s])).values(),
	);

	return (
		<div style={panelStyle}>
			<div style={panelSection}>
				<div style={panelSectionTitle}>Mentioned Sources</div>
				{uniqueSources.length === 0 ? (
					<div
						style={{
							fontSize: "11px",
							color: "var(--text-dim)",
							fontStyle: "italic",
						}}
					>
						Sources will appear here as the agent references your campaign
						materials.
					</div>
				) : (
					uniqueSources.map((source) => {
						const type = guessEntityType(source.sourceName);
						const colors = entityAvatarColors[type];
						return (
							<div key={source.sourceId} style={entityRowStyle}>
								<div style={{ ...avatarStyle, ...colors }}>
									{source.sourceName.charAt(0).toUpperCase()}
								</div>
								<div>
									<div style={entityNameStyle}>{source.sourceName}</div>
									<div
										style={{
											...entityTypeStyle,
											color: colors.color,
										}}
									>
										{type}
									</div>
								</div>
							</div>
						);
					})
				)}
			</div>

			<div style={panelSection}>
				<div style={panelSectionTitle}>Active Threads</div>
				<div
					style={{
						fontSize: "11px",
						color: "var(--text-dim)",
						fontStyle: "italic",
					}}
				>
					Thread tracking coming soon.
				</div>
			</div>
		</div>
	);
}
