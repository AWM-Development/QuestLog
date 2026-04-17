import type { CSSProperties } from "react";
import { entityAvatarColors } from "./styles.js";

type EntityType = keyof typeof entityAvatarColors;

interface EntityAvatarProps {
	name: string;
	entityType: EntityType;
	size?: number;
	style?: CSSProperties;
}

export function EntityAvatar({
	name,
	entityType,
	size = 30,
	style,
}: EntityAvatarProps) {
	const colors = entityAvatarColors[entityType];
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
			{name.charAt(0).toUpperCase()}
		</div>
	);
}
