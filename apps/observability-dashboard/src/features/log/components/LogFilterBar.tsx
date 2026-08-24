export type LogFilter = "all" | "shipped" | "blocked";

interface LogFilterBarProps {
	filter: LogFilter;
	onFilterChange: (filter: LogFilter) => void;
}

const FILTER_OPTIONS: { value: LogFilter; label: string }[] = [
	{ value: "all", label: "All Outcomes" },
	{ value: "shipped", label: "Shipped Only" },
	{ value: "blocked", label: "Blocked Only" },
];

/** Outcome filter, functional against the fetched feed data (`LogPage.tsx` filters `data-outcome`-tagged entries), not just a visual toggle — per this ticket's Scope. */
export function LogFilterBar({ filter, onFilterChange }: LogFilterBarProps) {
	return (
		<div className="filter-bar">
			{FILTER_OPTIONS.map((opt) => (
				<button
					key={opt.value}
					type="button"
					className={`btn-secondary${filter === opt.value ? " on" : ""}`}
					onClick={() => onFilterChange(opt.value)}
				>
					{opt.label}
				</button>
			))}
		</div>
	);
}
