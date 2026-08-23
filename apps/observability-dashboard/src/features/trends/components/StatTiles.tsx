import { formatCost, formatTurns } from "../utils/format.js";
import type { AggregateStats } from "../utils/stats.js";

interface StatTilesProps {
	stats: AggregateStats;
}

export function StatTiles({ stats }: StatTilesProps) {
	const tiles = [
		{
			label: "Avg Cost / Ticket",
			value: formatCost(stats.avgCost),
			accent: true,
		},
		{ label: "Median Cost / Ticket", value: formatCost(stats.medianCost) },
		{ label: "Avg Turns to Green", value: formatTurns(stats.avgTurnsToGreen) },
		{
			label: "Total System Cost",
			value: formatCost(stats.totalSystemCost),
			accent: true,
		},
	];

	return (
		<div className="stat-row">
			{tiles.map((tile) => (
				<div key={tile.label} className="stat-tile">
					<div className="label">{tile.label}</div>
					<div className={`value${tile.accent ? " accent" : ""}`}>
						{tile.value}
					</div>
				</div>
			))}
		</div>
	);
}
