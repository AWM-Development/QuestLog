import type { CSSProperties } from "react";
import { iconButtonBase, panelHeaderBase } from "../../components/styles.js";

export const chatHeaderBar: CSSProperties = {
	display: "flex",
	alignItems: "center",
	gap: "var(--space-3)",
	padding: "var(--space-3) var(--space-5)",
	borderBottom: "0.5px solid var(--border-subtle)",
	flexShrink: 0,
	minHeight: "48px",
	overflow: "hidden",
};

export const chatPanelSurface: CSSProperties = {
	background: "var(--bg-surface)",
	display: "flex",
	flexDirection: "column",
	height: "100%",
	flexShrink: 0,
};

export const chatDrawerSurface: CSSProperties = {
	...chatPanelSurface,
	width: 240,
	borderRight: "0.5px solid var(--border)",
	overflow: "hidden",
};

export const chatContextPanelSurface: CSSProperties = {
	...chatPanelSurface,
	width: 300,
	borderLeft: "0.5px solid var(--border)",
	overflow: "auto",
};

export const chatOverlayScrim: CSSProperties = {
	position: "fixed",
	inset: 0,
	zIndex: 19,
	background: "var(--overlay-scrim)",
	animation: "scrim-in 150ms ease",
};

export const chatPanelHeader: CSSProperties = {
	...panelHeaderBase,
	flexShrink: 0,
};

export const chatLabelXs: CSSProperties = {
	fontSize: "11px",
	fontWeight: 500,
	color: "var(--text-secondary)",
};

export const chatIconButton: CSSProperties = {
	...iconButtonBase,
	width: 28,
	height: 28,
	fontSize: "14px",
};

export const chatSearchInput: CSSProperties = {
	background: "var(--bg-elevated)",
	border: "1px solid var(--border)",
	borderRadius: "var(--r-sm)",
	padding: "6px 10px",
	fontSize: "11px",
	color: "var(--text-primary)",
	outline: "none",
	fontFamily: "var(--font-body)",
};

export const chatPillButton: CSSProperties = {
	fontSize: "10px",
	borderRadius: "var(--r-sm)",
	padding: "2px 7px",
	border: "1px dashed var(--border)",
	background: "transparent",
	color: "var(--text-dim)",
	cursor: "pointer",
	fontFamily: "var(--font-body)",
	transition: "all 150ms ease",
};
