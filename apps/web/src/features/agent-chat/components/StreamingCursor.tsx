/**
 * Blinking blue cursor appended to streaming agent text.
 * Decorative — hidden from screen readers.
 */
export function StreamingCursor() {
	return (
		<span
			aria-hidden="true"
			style={{
				display: "inline-block",
				width: 2,
				height: 16,
				background: "var(--accent)",
				verticalAlign: "text-bottom",
				marginLeft: 1,
				animation: "blink 1s infinite",
			}}
		/>
	);
}
