export type TrendsRange = "30" | "90" | "all";

export interface DateFilter {
	from?: Date;
	to?: Date;
}

/** Range -> `from`/`to` bounds; "all" omits both. See IMPLEMENTATION_NOTES.md § T-057 for why this is a day-window, not a run count. */
export function rangeToDateFilter(
	range: TrendsRange,
	now: Date = new Date(),
): DateFilter {
	if (range === "all") return {};
	const days = range === "30" ? 30 : 90;
	const from = new Date(now);
	from.setDate(from.getDate() - days);
	return { from };
}
