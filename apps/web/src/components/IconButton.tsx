import { type ButtonHTMLAttributes, type CSSProperties, useState } from "react";
import { iconButtonBase } from "./styles.js";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	label: string;
	size?: 24 | 28 | 32;
	active?: boolean;
	/** Style applied on hover (merged with base). Ignored when disabled. */
	hoverStyle?: CSSProperties;
	/** Style applied on mousedown/mouseup. Ignored when disabled. */
	pressStyle?: CSSProperties;
}

const defaultHoverBySize: CSSProperties = {
	color: "var(--text-secondary)",
};

export function IconButton({
	label,
	size = 24,
	active = false,
	hoverStyle,
	pressStyle,
	disabled,
	style,
	children,
	onMouseEnter,
	onMouseLeave,
	onMouseDown,
	onMouseUp,
	...rest
}: IconButtonProps) {
	const [hovered, setHovered] = useState(false);
	const [pressed, setPressed] = useState(false);

	const computedStyle: CSSProperties = {
		...iconButtonBase,
		width: size,
		height: size,
		...(active
			? { color: "var(--accent)", backgroundColor: "var(--accent-muted)" }
			: {}),
		...(!disabled && hovered ? (hoverStyle ?? defaultHoverBySize) : {}),
		...(!disabled && pressed ? (pressStyle ?? {}) : {}),
		...style,
	};

	return (
		<button
			type="button"
			aria-label={label}
			disabled={disabled}
			style={computedStyle}
			onMouseEnter={(e) => {
				setHovered(true);
				onMouseEnter?.(e);
			}}
			onMouseLeave={(e) => {
				setHovered(false);
				setPressed(false);
				onMouseLeave?.(e);
			}}
			onMouseDown={(e) => {
				setPressed(true);
				onMouseDown?.(e);
			}}
			onMouseUp={(e) => {
				setPressed(false);
				onMouseUp?.(e);
			}}
			{...rest}
		>
			{children}
		</button>
	);
}
