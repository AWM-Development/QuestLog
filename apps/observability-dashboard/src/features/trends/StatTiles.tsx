import { fmtCost, fmtTurns } from "./format.js";
import type { AggregateStats } from "./stats.js";

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
		<div
			className="stat-row"
			style={{
				display: "grid",
				gridTemplateColumns: "repeat(4, 1fr)",
				gap: "var(--space-3)",
				marginBottom: "var(--space-3)",
			}}
		>
			{tiles.map((tile) => (
				<div
					key={tile.label}
					className="stat-tile"
					style={{
						background: "var(--bg-elevated)",
						border: "0.5px solid var(--border)",
						borderRadius: "var(--r-md)",
						padding: "var(--space-3-5)",
					}}
				>
					<div
						className="label"
						style={{
							fontSize: "10px",
							color: "var(--text-muted)",
							textTransform: "uppercase",
							letterSpacing: "0.04em",
							marginBottom: "4px",
						}}
					>
						{tile.label}
					</div>
					<div
						className="value"
						style={{
							fontFamily: "var(--font-mono)",
							fontSize: "20px",
							fontWeight: 500,
							color: tile.accent ? "var(--accent)" : "var(--text-primary)",
						}}
					>
						{tile.value}
					</div>
				</div>
			))}
		</div>
	);
}
