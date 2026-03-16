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

export const overlineLabel: CSSProperties = {
	fontSize: "0.625rem",
	letterSpacing: "0.06em",
	textTransform: "uppercase" as const,
	color: "var(--text-muted)",
	fontWeight: 500,
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
	boxShadow: "0 0 0 3px rgba(96, 184, 255, 0.06)",
};
