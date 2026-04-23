import {
	type CSSProperties,
	type SelectHTMLAttributes,
	forwardRef,
	useState,
} from "react";
import { inputField, inputFieldFocus } from "../styles.js";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
	background?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
	function Select({ background, style, ...rest }, ref) {
		const [focused, setFocused] = useState(false);

		const computedStyle: CSSProperties = {
			...inputField,
			...(background ? { backgroundColor: background } : {}),
			...(focused ? inputFieldFocus : {}),
			...style,
		};

		return (
			<select
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
