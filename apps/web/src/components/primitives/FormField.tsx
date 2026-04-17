import {
	type CSSProperties,
	Children,
	type ReactElement,
	type ReactNode,
	cloneElement,
	isValidElement,
	useId,
} from "react";

interface FormFieldProps {
	label: string;
	/** Explicit id to bind the label to. When omitted, an id is auto-generated and injected into a single ReactElement child without its own id. */
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
	const generatedId = useId();
	const fieldId = htmlFor ?? generatedId;

	let renderedChildren: ReactNode = children;
	if (!htmlFor) {
		const arr = Children.toArray(children);
		if (arr.length === 1 && isValidElement(arr[0])) {
			const child = arr[0] as ReactElement<{ id?: string }>;
			if (child.props.id == null) {
				renderedChildren = cloneElement(child, { id: fieldId });
			}
		}
	}

	return (
		<div>
			<label htmlFor={fieldId} style={compact ? labelCompactStyle : labelStyle}>
				{label}
				{required && <span style={{ color: "var(--status-error)" }}> *</span>}
			</label>
			{renderedChildren}
			{error && (
				<p role="alert" style={errorStyle}>
					{error}
				</p>
			)}
			{hint && !error && <p style={hintStyle}>{hint}</p>}
		</div>
	);
}
