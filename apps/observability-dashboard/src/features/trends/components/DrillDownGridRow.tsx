import type { CSSProperties, ReactNode } from "react";

/**
 * One column template, used by both the drill-down header and every data
 * row. The mockup originally laid each row out as its own independent
 * nested `<table>`, so its columns drifted out of alignment with the header
 * at different widths (Docs/mockups/observability-dashboard/NOTES.md,
 * "Layout bug found and fixed in review") — sharing this single constant
 * through one component, rather than letting each row re-derive its own
 * column widths, makes that bug structurally impossible to reintroduce.
 */
export const DRILLDOWN_GRID_TEMPLATE =
	"minmax(180px, 2.2fr) 64px minmax(70px, 0.9fr) minmax(85px, 1fr) minmax(85px, 1fr) minmax(95px, 1fr) minmax(70px, 0.9fr) 24px";

interface DrillDownGridRowProps {
	children: ReactNode;
	className?: string;
	style?: CSSProperties;
	"data-testid"?: string;
}

export function DrillDownGridRow({
	children,
	className,
	style,
	...rest
}: DrillDownGridRowProps) {
	return (
		<div
			className={className}
			style={{
				display: "grid",
				gridTemplateColumns: DRILLDOWN_GRID_TEMPLATE,
				columnGap: "var(--space-3)",
				alignItems: "center",
				...style,
			}}
			{...rest}
		>
			{children}
		</div>
	);
}
