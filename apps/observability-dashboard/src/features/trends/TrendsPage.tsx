import { useState } from "react";
import { trpc } from "../../lib/trpc.js";
import { CostScatterChart } from "./CostScatterChart.js";
import { DrillDown } from "./DrillDown.js";
import { FilterBar } from "./FilterBar.js";
import { StatTiles } from "./StatTiles.js";
import { TierRow } from "./TierRow.js";
import { TokensChart } from "./TokensChart.js";
import { type TrendsRange, rangeToDateFilter } from "./range.js";
import { aggregateStats, perTierStats } from "./stats.js";
import type { TrendRun } from "./types.js";

export function TrendsPage() {
	const [range, setRange] = useState<TrendsRange>("30");
	const [excludeEmpty, setExcludeEmpty] = useState(true);

	const dateFilter = rangeToDateFilter(range);
	const { data } = trpc.observability.trends.useQuery({
		...dateFilter,
		includeEmptyRuns: !excludeEmpty,
	});

	const runs = (data ?? []) as TrendRun[];
	const nonEmptyRuns = runs.filter((r) => !r.emptyRun);

	return (
		<div className="page-body">
			<FilterBar
				range={range}
				onRangeChange={setRange}
				excludeEmpty={excludeEmpty}
				onToggleExcludeEmpty={() => setExcludeEmpty((v) => !v)}
			/>
			<StatTiles stats={aggregateStats(nonEmptyRuns)} />
			<TierRow byTier={perTierStats(nonEmptyRuns)} />
			<div className="chart-grid">
				<TokensChart runs={nonEmptyRuns} />
				<CostScatterChart runs={nonEmptyRuns} />
			</div>
			<DrillDown runs={runs} />
		</div>
	);
}
