import { type CSSProperties, type InputHTMLAttributes, useState } from "react";
import { inputField, inputFieldFocus } from "./styles.js";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
	/** Override background (e.g. "var(--bg-void)" for inputs inside elevated modals) */
	background?: string;
}

export function Input({ background, style, ...rest }: InputProps) {
	const [focused, setFocused] = useState(false);

	const computedStyle: CSSProperties = {
		...inputField,
		...(background ? { backgroundColor: background } : {}),
		...(focused ? inputFieldFocus : {}),
		...style,
	};

	return (
		<input
			style={computedStyle}
			onFocus={(e) => {
				setFocused(true);
				rest.onFocus?.(e);
			}}
			onBlur={(e) => {
				setFocused(false);
				rest.onBlur?.(e);
			}}
			{...rest}
		/>
	);
}
