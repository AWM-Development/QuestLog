import {
	CartesianGrid,
	ComposedChart,
	Legend,
	Line,
	ResponsiveContainer,
	Scatter,
	Tooltip,
	XAxis,
	YAxis,
	ZAxis,
} from "recharts";
import { costVsDiffPoints, fitLine } from "../lib/stats.js";
import type { TrendRun } from "../lib/types.js";

interface CostScatterChartProps {
	runs: TrendRun[];
}

const TIER_COLOR: Record<string, string> = {
	s: "var(--status-info)",
	m: "var(--status-warning)",
	l: "var(--status-error)",
};

/** Cost-vs-diff-size scatter, points colored by complexity tier, with a fit line. */
export function CostScatterChart({ runs }: CostScatterChartProps) {
	const points = costVsDiffPoints(runs);
	const line = fitLine(points);

	const byTier: Record<string, typeof points> = { s: [], m: [], l: [] };
	for (const p of points) {
		if (p.tier) byTier[p.tier]?.push(p);
	}

	const xs = points.map((p) => p.linesChanged);
	const minX = xs.length > 0 ? Math.min(...xs) : 0;
	const maxX = xs.length > 0 ? Math.max(...xs) : 1;
	const fitLineData = [
		{ linesChanged: minX, fit: line.slope * minX + line.intercept },
		{ linesChanged: maxX, fit: line.slope * maxX + line.intercept },
	];

	return (
		<div className="panel">
			<div className="section-title">Cost vs. Diff Size</div>
			<div className="section-sub">
				Cost per run against lines changed, colored by tier — dashed line is the
				fit
			</div>
			<ResponsiveContainer width="100%" height={200}>
				<ComposedChart>
					<CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
					<XAxis
						dataKey="linesChanged"
						type="number"
						name="lines changed"
						tick={{ fill: "var(--text-muted)", fontSize: 9 }}
					/>
					<YAxis
						dataKey="cost"
						type="number"
						name="cost"
						tick={{ fill: "var(--text-muted)", fontSize: 9 }}
					/>
					<ZAxis range={[60, 60]} />
					<Tooltip cursor={{ strokeDasharray: "3 3" }} />
					<Legend />
					{(["s", "m", "l"] as const).map((tier) => (
						<Scatter
							key={tier}
							name={tier.toUpperCase()}
							data={byTier[tier]}
							fill={TIER_COLOR[tier]}
						/>
					))}
					<Line
						data={fitLineData}
						dataKey="fit"
						stroke="var(--text-dim)"
						strokeDasharray="4 3"
						dot={false}
						name="fit"
						legendType="none"
					/>
				</ComposedChart>
			</ResponsiveContainer>
		</div>
	);
}
