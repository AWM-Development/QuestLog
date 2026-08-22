export type TrendsRange = "30" | "90" | "all";

export interface DateFilter {
	from?: Date;
	to?: Date;
}

const RANGE_DAYS: Record<Exclude<TrendsRange, "all">, number> = {
	"30": 30,
	"90": 90,
};

/**
 * Translates the filter bar's range selection into `from`/`to` bounds for
 * the `observability.trends` endpoint. "all" omits both bounds. There's no
 * "last N runs" concept on the endpoint itself (it filters by date, not
 * row count) — a day-window is the closest real equivalent, and unlike the
 * mockup's fixture (one fixed run set multiplied by a range factor), a real
 * date window naturally returns a genuinely different set of runs per range
 * (see Docs/mockups/observability-dashboard/NOTES.md's "Filter buttons"
 * section).
 */
export function rangeToDateFilter(
	range: TrendsRange,
	now: Date = new Date(),
): DateFilter {
	if (range === "all") return {};
	const days = RANGE_DAYS[range];
	const from = new Date(now);
	from.setDate(from.getDate() - days);
	return { from };
}
