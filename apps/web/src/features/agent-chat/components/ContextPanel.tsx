import type { CSSProperties } from "react";
import {
	entityAvatarColors,
	panelSection,
	panelSectionTitle,
} from "../../../components/styles.js";
import type { MessageSource } from "../types.js";

interface ContextPanelProps {
	sources: MessageSource[];
	onClose: () => void;
	isOverlay?: boolean;
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

const overlayPanelStyle: CSSProperties = {
	...panelStyle,
	position: "fixed",
	top: 0,
	right: 0,
	bottom: 0,
	zIndex: 20,
	animation: "panel-in 200ms ease",
};

const panelHeaderStyle: CSSProperties = {
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	padding: "10px 14px",
	borderBottom: "0.5px solid var(--border-subtle)",
	flexShrink: 0,
};

const panelHeaderLabel: CSSProperties = {
	fontSize: "12px",
	fontWeight: 500,
	color: "var(--text-secondary)",
};

const closeBtnStyle: CSSProperties = {
	width: 24,
	height: 24,
	borderRadius: "var(--r-sm)",
	border: "none",
	background: "transparent",
	color: "var(--text-muted)",
	cursor: "pointer",
	display: "flex",
	alignItems: "center",
	justifyContent: "center",
	fontSize: "14px",
	transition: "all 150ms ease",
};

const entityRowStyle: CSSProperties = {
	display: "flex",
	alignItems: "center",
	gap: "10px",
	padding: "6px 0",
};

const avatarStyle: CSSProperties = {
	width: 30,
	height: 30,
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

const scrimStyle: CSSProperties = {
	position: "fixed",
	inset: 0,
	zIndex: 19,
	background: "rgba(9,13,18,0.5)",
	animation: "scrim-in 150ms ease",
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

export function ContextPanel({
	sources,
	onClose,
	isOverlay,
}: ContextPanelProps) {
	// Deduplicate sources by sourceId
	const uniqueSources = Array.from(
		new Map(sources.map((s) => [s.sourceId, s])).values(),
	);

	const panel = (
		<div style={isOverlay ? overlayPanelStyle : panelStyle}>
			<div style={panelHeaderStyle}>
				<span style={panelHeaderLabel}>Context</span>
				<button
					type="button"
					style={closeBtnStyle}
					onClick={onClose}
					aria-label="Close context panel"
				>
					&#x2715;
				</button>
			</div>

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

	if (isOverlay) {
		return (
			<>
				{/* biome-ignore lint/a11y/useKeyWithClickEvents: scrim is aria-hidden, not keyboard-interactive */}
				<div style={scrimStyle} onClick={onClose} aria-hidden="true" />
				{panel}
			</>
		);
	}

	return panel;
}
