import {
	type CSSProperties,
	type InputHTMLAttributes,
	forwardRef,
	useState,
} from "react";
import { inputField, inputFieldFocus } from "./styles.js";

interface InputProps
	extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
	/** Override background (e.g. "var(--bg-void)" for inputs inside elevated modals) */
	background?: string;
	/** "md" (default) matches forms; "sm" matches compact search inputs. */
	size?: "sm" | "md";
}

const smallStyle: CSSProperties = {
	padding: "6px 10px",
	fontSize: "11px",
	borderRadius: "var(--r-sm)",
};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
	{ background, size = "md", style, ...rest },
	ref,
) {
	const [focused, setFocused] = useState(false);

	const computedStyle: CSSProperties = {
		...inputField,
		...(size === "sm" ? smallStyle : {}),
		...(background ? { backgroundColor: background } : {}),
		...(focused ? inputFieldFocus : {}),
		...style,
	};

	return (
		<input
			ref={ref}
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
});
