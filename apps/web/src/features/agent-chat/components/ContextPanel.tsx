import type { CSSProperties } from "react";
import {
	entityAvatarColors,
	panelSection,
	panelSectionTitle,
} from "../../../components/styles.js";
import {
	chatContextPanelSurface,
	chatIconButton,
	chatOverlayScrim,
	chatPanelHeader,
} from "../styles.js";
import type { MessageSource } from "../types.js";

interface ContextPanelProps {
	sources: MessageSource[];
	onClose: () => void;
	isOverlay?: boolean;
}

const panelStyle: CSSProperties = {
	...chatContextPanelSurface,
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

const panelHeaderStyle: CSSProperties = chatPanelHeader;

const panelHeaderLabel: CSSProperties = {
	fontSize: "12px",
	fontWeight: 500,
	color: "var(--text-secondary)",
};

const closeBtnStyle: CSSProperties = {
	...chatIconButton,
	width: 24,
	height: 24,
	fontSize: "14px",
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

/** Tablet overlay: dim main + panel only; keep the nav rail clickable (matches ConversationDrawer). */
const overlayScrimStyle: CSSProperties = {
	...chatOverlayScrim,
	left: "var(--rail-width)",
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
				<div style={overlayScrimStyle} onClick={onClose} aria-hidden="true" />
				{panel}
			</>
		);
	}

	return panel;
}
