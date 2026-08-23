import { fmtCost, fmtTurns } from "../utils/format.js";
import type { AggregateStats } from "../utils/stats.js";

interface StatTilesProps {
	stats: AggregateStats;
}

export function StatTiles({ stats }: StatTilesProps) {
	const tiles = [
		{ label: "Avg Cost / Ticket", value: fmtCost(stats.avgCost), accent: true },
		{ label: "Median Cost / Ticket", value: fmtCost(stats.medianCost) },
		{ label: "Avg Turns to Green", value: fmtTurns(stats.avgTurnsToGreen) },
		{
			label: "Total System Cost",
			value: fmtCost(stats.totalSystemCost),
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
