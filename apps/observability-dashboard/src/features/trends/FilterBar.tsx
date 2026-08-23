import type { TrendsRange } from "./range.js";

interface FilterBarProps {
	range: TrendsRange;
	onRangeChange: (range: TrendsRange) => void;
	excludeEmpty: boolean;
	onToggleExcludeEmpty: () => void;
}

const RANGE_OPTIONS: { value: TrendsRange; label: string }[] = [
	{ value: "30", label: "Last 30 Days" },
	{ value: "90", label: "Last 90 Days" },
	{ value: "all", label: "All Time" },
];

export function FilterBar({
	range,
	onRangeChange,
	excludeEmpty,
	onToggleExcludeEmpty,
}: FilterBarProps) {
	return (
		<div
			className="filter-bar"
			style={{
				display: "flex",
				alignItems: "center",
				gap: "var(--space-2)",
				marginBottom: "var(--space-5)",
				flexWrap: "wrap",
			}}
		>
			{RANGE_OPTIONS.map((opt) => (
				<button
					key={opt.value}
					type="button"
					className={`btn-secondary${range === opt.value ? " on" : ""}`}
					onClick={() => onRangeChange(opt.value)}
				>
					{opt.label}
				</button>
			))}
			<div style={{ flex: 1 }} />
			<button
				type="button"
				className={`btn-secondary${excludeEmpty ? " on" : ""}`}
				onClick={onToggleExcludeEmpty}
			>
				Exclude Empty Runs
			</button>
		</div>
	);
}
