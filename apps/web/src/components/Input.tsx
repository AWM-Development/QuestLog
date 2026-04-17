import {
	type CSSProperties,
	type InputHTMLAttributes,
	forwardRef,
	useState,
} from "react";
import { inputField, inputFieldFocus } from "./styles.js";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
	/** Override background (e.g. "var(--bg-void)" for inputs inside elevated modals) */
	background?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
	{ background, style, ...rest },
	ref,
) {
	const [focused, setFocused] = useState(false);

	const computedStyle: CSSProperties = {
		...inputField,
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
