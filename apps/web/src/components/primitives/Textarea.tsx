import {
	type CSSProperties,
	type TextareaHTMLAttributes,
	forwardRef,
	useState,
} from "react";
import { inputField, inputFieldFocus } from "../styles.js";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
	/** Override background (e.g. "var(--bg-void)" for textareas inside elevated modals) */
	background?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
	function Textarea({ background, style, ...rest }, ref) {
		const [focused, setFocused] = useState(false);

		const computedStyle: CSSProperties = {
			...inputField,
			fontFamily: "var(--font-body)",
			resize: "vertical",
			...(background ? { backgroundColor: background } : {}),
			...(focused ? inputFieldFocus : {}),
			...style,
		};

		return (
			<textarea
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
	},
);
