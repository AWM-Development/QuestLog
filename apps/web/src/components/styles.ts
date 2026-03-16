import type { CSSProperties } from "react";

/**
 * Shared button style presets using design tokens.
 * These are base styles — components can spread and override as needed.
 */

export const buttonAccent: CSSProperties = {
	backgroundColor: "var(--color-accent)",
	color: "var(--color-text-inverse)",
	border: "none",
	borderRadius: "var(--radius-md)",
	padding: "var(--spacing-sm) var(--spacing-lg)",
	fontWeight: 600,
	cursor: "pointer",
	fontSize: "0.875rem",
};

export const buttonSecondary: CSSProperties = {
	padding: "var(--spacing-sm) var(--spacing-lg)",
	borderRadius: "var(--radius-md)",
	border: "1px solid var(--color-border)",
	backgroundColor: "transparent",
	color: "var(--color-text-secondary)",
	cursor: "pointer",
	fontSize: "0.875rem",
};
