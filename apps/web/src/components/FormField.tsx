import type { CSSProperties, ReactNode } from "react";

interface FormFieldProps {
	label: string;
	/** Associates label with input via htmlFor/id pairing */
	htmlFor?: string;
	hint?: string;
	error?: string;
	required?: boolean;
	/** Reduces label to 0.6875rem / muted color for dense forms (e.g. FinalizeForm) */
	compact?: boolean;
	children: ReactNode;
}

const labelStyle: CSSProperties = {
	display: "block",
	fontSize: "0.875rem",
	fontWeight: 600,
	color: "var(--text-secondary)",
	marginBottom: "var(--space-1)",
};

const labelCompactStyle: CSSProperties = {
	display: "block",
	fontSize: "0.6875rem",
	color: "var(--text-muted)",
	marginBottom: 0,
};

const errorStyle: CSSProperties = {
	fontSize: "0.75rem",
	color: "var(--status-error)",
	marginTop: "var(--space-1)",
};

const hintStyle: CSSProperties = {
	fontSize: "0.75rem",
	color: "var(--text-muted)",
	marginTop: "var(--space-1)",
};

export function FormField({
	label,
	htmlFor,
	hint,
	error,
	required,
	compact = false,
	children,
}: FormFieldProps) {
	return (
		<div>
			<label htmlFor={htmlFor} style={compact ? labelCompactStyle : labelStyle}>
				{label}
				{required && <span style={{ color: "var(--status-error)" }}> *</span>}
			</label>
			{children}
			{error && (
				<p role="alert" style={errorStyle}>
					{error}
				</p>
			)}
			{hint && !error && <p style={hintStyle}>{hint}</p>}
		</div>
	);
}
