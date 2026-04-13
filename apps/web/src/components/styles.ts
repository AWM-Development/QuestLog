import type { CSSProperties } from "react";

/**
 * Shared style presets using design tokens.
 * See Docs/DESIGN_SYSTEM.md for the full specification.
 *
 * These are base styles — components can spread and override as needed:
 *   style={{ ...buttonAccent, opacity: isDisabled ? 0.5 : 1 }}
 */

// ── Buttons ──

export const buttonAccent: CSSProperties = {
	backgroundColor: "var(--accent)",
	color: "var(--bg-void)",
	border: "none",
	borderRadius: "var(--r-md)",
	padding: "6px 14px",
	fontFamily: "var(--font-body)",
	fontWeight: 500,
	fontSize: "0.875rem",
	cursor: "pointer",
	transition: "all 0.15s",
};

export const buttonSecondary: CSSProperties = {
	padding: "6px 12px",
	borderRadius: "var(--r-sm)",
	border: "0.5px solid var(--border)",
	backgroundColor: "transparent",
	color: "var(--text-muted)",
	fontFamily: "var(--font-body)",
	fontSize: "0.875rem",
	cursor: "pointer",
	transition: "all 0.15s",
};

export const buttonGhost: CSSProperties = {
	padding: "3px 10px",
	borderRadius: "var(--r-sm)",
	border: "none",
	backgroundColor: "transparent",
	color: "var(--text-muted)",
	fontFamily: "var(--font-body)",
	fontSize: "0.875rem",
	cursor: "pointer",
	transition: "all 0.15s",
};

export const buttonAction: CSSProperties = {
	padding: "6px 14px",
	borderRadius: "var(--r-md)",
	border: "0.5px solid var(--border)",
	backgroundColor: "rgba(14, 24, 32, 0.6)",
	color: "var(--text-secondary)",
	fontFamily: "var(--font-body)",
	fontSize: "0.75rem",
	cursor: "pointer",
	transition: "all 0.2s",
};

export const iconButtonBase: CSSProperties = {
	width: 24,
	height: 24,
	borderRadius: "var(--r-sm)",
	border: "none",
	background: "transparent",
	color: "var(--text-muted)",
	cursor: "pointer",
	display: "inline-flex",
	alignItems: "center",
	justifyContent: "center",
	transition: "all 150ms ease",
};

export const chipBase: CSSProperties = {
	display: "inline-flex",
	alignItems: "center",
	gap: "var(--space-1)",
	padding: "2px 8px",
	borderRadius: "var(--r-sm)",
	fontFamily: "var(--font-body)",
	fontSize: "11px",
};

export const cardSurface: CSSProperties = {
	backgroundColor: "var(--bg-elevated)",
	border: "1px solid var(--border-subtle)",
	borderRadius: "var(--r-md)",
};

// ── Entity links ──

/** Base inline entity link style. Apply entity-specific color via additional props. */
export const entityLink: CSSProperties = {
	cursor: "pointer",
	textDecoration: "none",
	transition: "all 0.2s",
	borderBottomWidth: "1px",
	borderBottomStyle: "dotted",
};

/** Entity type color sets for inline use */
export const entityColors = {
	npc: {
		color: "var(--ent-npc)",
		borderBottomColor: "rgba(96, 184, 255, 0.3)",
	},
	faction: {
		color: "var(--ent-faction)",
		borderBottomColor: "rgba(64, 216, 160, 0.3)",
	},
	location: {
		color: "var(--ent-location)",
		borderBottomColor: "rgba(160, 184, 255, 0.3)",
	},
	item: {
		color: "var(--ent-item)",
		borderBottomColor: "rgba(128, 216, 216, 0.3)",
	},
	story_arc: {
		color: "var(--ent-arc)",
		borderBottomColor: "rgba(192, 160, 255, 0.3)",
	},
} as const;

/** Entity avatar background/text color sets */
export const entityAvatarColors = {
	npc: {
		backgroundColor: "var(--ent-npc-bg)",
		color: "var(--ent-npc)",
	},
	faction: {
		backgroundColor: "var(--ent-faction-bg)",
		color: "var(--ent-faction)",
	},
	location: {
		backgroundColor: "var(--ent-location-bg)",
		color: "var(--ent-location)",
	},
	item: {
		backgroundColor: "var(--ent-item-bg)",
		color: "var(--ent-item)",
	},
	story_arc: {
		backgroundColor: "var(--ent-arc-bg)",
		color: "var(--ent-arc)",
	},
} as const;

// ── Source citation chips ──

export const sourceChipBase: CSSProperties = {
	display: "inline-flex",
	alignItems: "center",
	gap: "4px",
	padding: "3px 10px",
	borderRadius: "var(--r-pill)",
	fontSize: "0.6875rem",
	cursor: "pointer",
	transition: "all 0.15s",
};

export const sourceChipColors = {
	document: {
		backgroundColor: "var(--ent-npc-bg)",
		color: "var(--ent-npc)",
		border: "0.5px solid var(--ent-npc-border)",
	},
	session: {
		backgroundColor: "var(--ent-faction-bg)",
		color: "var(--ent-faction)",
		border: "0.5px solid var(--ent-faction-border)",
	},
	entity: {
		backgroundColor: "var(--ent-location-bg)",
		color: "var(--ent-location)",
		border: "0.5px solid var(--ent-location-border)",
	},
} as const;

// ── Layout ──

export const panelSection: CSSProperties = {
	padding: "12px 14px",
	borderBottom: "1px solid var(--border-subtle)",
};

export const panelSectionTitle: CSSProperties = {
	fontSize: "0.625rem",
	letterSpacing: "0.06em",
	textTransform: "uppercase" as const,
	color: "var(--text-muted)",
	marginBottom: "10px",
	fontWeight: 500,
};

export const panelHeaderBase: CSSProperties = {
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	padding: "var(--space-3) var(--space-4)",
	borderBottom: "0.5px solid var(--border-subtle)",
};

export const overlineLabel: CSSProperties = {
	fontSize: "0.625rem",
	letterSpacing: "0.06em",
	textTransform: "uppercase" as const,
	color: "var(--text-muted)",
	fontWeight: 500,
};

// ── Chat message chrome ──

export const chatMessageHeader: CSSProperties = {
	display: "flex",
	alignItems: "center",
	gap: "var(--space-2)",
	marginBottom: "var(--space-2)",
};

export const chatMessageLabel: CSSProperties = {
	fontSize: "11px",
	fontWeight: 500,
	color: "var(--text-muted)",
};

export const chatStatusDot: CSSProperties = {
	width: 6,
	height: 6,
	borderRadius: "50%",
	flexShrink: 0,
};

export const pageContainer: CSSProperties = {
	maxWidth: "760px",
	margin: "0 auto",
	padding: "var(--space-8) var(--space-6)",
};

export const pageHeaderRow: CSSProperties = {
	display: "flex",
	justifyContent: "space-between",
	alignItems: "center",
	marginBottom: "var(--space-8)",
};

export const pageTitle: CSSProperties = {
	fontFamily: "var(--font-display)",
	fontSize: "1.75rem",
	fontWeight: 700,
	color: "var(--text-primary)",
};

export const pageSubtitle: CSSProperties = {
	fontSize: "0.875rem",
	color: "var(--text-secondary)",
};

// ── Cards ──

export const hoverCard: CSSProperties = {
	position: "fixed",
	width: "300px",
	borderRadius: "var(--r-md)",
	overflow: "hidden",
	zIndex: 100,
	transition: "opacity 0.2s ease, transform 0.2s ease",
};

export const elevatedCard: CSSProperties = {
	backgroundColor: "var(--bg-elevated)",
	border: "0.5px solid var(--border)",
	borderRadius: "var(--r-md)",
	overflow: "hidden",
};

// ── Form elements ──

export const inputField: CSSProperties = {
	backgroundColor: "var(--bg-elevated)",
	border: "1px solid var(--border)",
	borderRadius: "var(--r-md)",
	padding: "10px 14px",
	fontSize: "0.875rem",
	fontFamily: "var(--font-body)",
	color: "var(--text-primary)",
	outline: "none",
	transition: "border-color 0.2s, box-shadow 0.2s",
};

export const inputFieldFocus: CSSProperties = {
	borderColor: "var(--border-hover)",
	boxShadow: "0 0 0 3px var(--state-active-soft)",
};

// ── Inline alerts ──
// Use these for inline contextual messages (errors, warnings) inside cards or
// queue items. Pair with small ghost buttons for actions.

export const inlineAlertError: CSSProperties = {
	padding: "var(--space-3) var(--space-4)",
	border: "1px solid var(--status-error)",
	borderRadius: "var(--r-sm)",
	backgroundColor: "var(--status-error-muted)",
};

export const inlineAlertWarning: CSSProperties = {
	padding: "var(--space-3) var(--space-4)",
	border: "1px solid var(--status-warning)",
	borderRadius: "var(--r-sm)",
	backgroundColor: "var(--status-warning-muted)",
};

export const buttonSmallAccent: CSSProperties = {
	...buttonAccent,
	padding: "var(--space-1) var(--space-3)",
	fontSize: "0.75rem",
};

export const buttonSmallSecondary: CSSProperties = {
	...buttonSecondary,
	padding: "var(--space-1) var(--space-3)",
	fontSize: "0.75rem",
};

// ── Session notes editor (Milestone 4.1) ──

export const editorSurface: CSSProperties = {
	backgroundColor: "var(--bg-surface)",
	color: "var(--text-primary)",
	fontFamily: "var(--font-body)",
	fontSize: "0.875rem",
	lineHeight: 1.75,
	outline: "none",
	flex: 1,
	overflow: "auto",
	padding: "var(--space-4)",
};

export const floatingMenu: CSSProperties = {
	backgroundColor: "var(--bg-focal)",
	border: "1px solid var(--border-hover)",
	borderRadius: "var(--r-md)",
	boxShadow: "var(--shadow-focal)",
	padding: "var(--space-1)",
	display: "flex",
	gap: "2px",
	flexWrap: "wrap",
};

export const floatingMenuDropdown: CSSProperties = {
	backgroundColor: "var(--bg-focal)",
	border: "1px solid var(--border-hover)",
	borderRadius: "var(--r-md)",
	boxShadow: "var(--shadow-focal)",
	padding: "var(--space-1) 0",
	maxHeight: "240px",
	overflowY: "auto" as const,
	minWidth: "180px",
};

export const floatingMenuOption: CSSProperties = {
	padding: "var(--space-2) var(--space-3)",
	fontSize: "0.8125rem",
	color: "var(--text-secondary)",
	cursor: "pointer",
	display: "flex",
	alignItems: "center",
	gap: "var(--space-2)",
};

export const saveStatusText: CSSProperties = {
	fontFamily: "var(--font-mono)",
	fontSize: "0.6875rem",
	color: "var(--text-muted)",
};

/** Notion-style overline above the session title — `SESSION N · MAR 15, 2026 · DRAFT`. */
export const sessionOverline: CSSProperties = {
	fontFamily: "var(--font-mono)",
	fontSize: "0.625rem",
	letterSpacing: "0.06em",
	textTransform: "uppercase",
	color: "var(--text-muted)",
	display: "inline-flex",
	alignItems: "center",
	gap: "0.5em",
	flexWrap: "wrap",
};

/** Borderless title input styled as a display heading. */
export const sessionTitleInput: CSSProperties = {
	fontFamily: "var(--font-display)",
	fontSize: "24px",
	fontWeight: 600,
	color: "var(--text-primary)",
	background: "transparent",
	border: "none",
	outline: "none",
	width: "100%",
	padding: 0,
	marginTop: "var(--space-2)",
	marginBottom: "var(--space-3)",
};
