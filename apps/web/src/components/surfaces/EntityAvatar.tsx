import type { CSSProperties } from "react";
import { entityAvatarColors } from "../styles.js";

export type EntityType = keyof typeof entityAvatarColors;

interface EntityAvatarProps {
	name: string;
	entityType: EntityType;
	size?: number;
	style?: CSSProperties;
}

/**
 * Returns the `{ backgroundColor, color }` pair associated with an entity type.
 * Prefer this over importing `entityAvatarColors` directly in feature code.
 */
export function getEntityPalette(entityType: EntityType) {
	return entityAvatarColors[entityType];
}

export function EntityAvatar({
	name,
	entityType,
	size = 30,
	style,
}: EntityAvatarProps) {
	const colors = entityAvatarColors[entityType];
	const initial = name.trim().charAt(0).toUpperCase() || "?";
	return (
		<div
			style={{
				width: size,
				height: size,
				borderRadius: "var(--r-md)",
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				fontSize: "12px",
				fontWeight: 600,
				flexShrink: 0,
				...colors,
				...style,
			}}
		>
			{initial}
		</div>
	);
}
