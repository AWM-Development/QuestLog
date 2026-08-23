import {
	Bar,
	BarChart,
	CartesianGrid,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import type { TrendRun } from "../lib/types.js";

interface TokensChartProps {
	runs: TrendRun[];
}

const SEGMENTS = [
	{ key: "inputTokens", label: "input", color: "#2e4856" },
	{ key: "outputTokens", label: "output", color: "var(--accent)" },
	{ key: "cacheCreationInputTokens", label: "cache-write", color: "#40d8a0" },
	{ key: "cacheReadInputTokens", label: "cache-read", color: "#c0a0ff" },
] as const;

/** Tokens-per-run stacked bar chart (input/output/cache-write/cache-read). */
export function TokensChart({ runs }: TokensChartProps) {
	const data = runs.map((r) => ({
		ticketId: r.ticketId ?? "—",
		inputTokens: r.inputTokens,
		outputTokens: r.outputTokens,
		cacheCreationInputTokens: r.cacheCreationInputTokens,
		cacheReadInputTokens: r.cacheReadInputTokens,
	}));

	return (
		<div className="panel">
			<div className="section-title">Tokens Per Run</div>
			<div className="section-sub">
				Input / output / cache-write / cache-read, most recent runs
			</div>
			<ResponsiveContainer width="100%" height={200}>
				<BarChart data={data}>
					<CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
					<XAxis
						dataKey="ticketId"
						tick={{ fill: "var(--text-muted)", fontSize: 9 }}
					/>
					<YAxis tick={{ fill: "var(--text-muted)", fontSize: 9 }} />
					<Tooltip />
					{SEGMENTS.map((seg) => (
						<Bar
							key={seg.key}
							dataKey={seg.key}
							stackId="tokens"
							fill={seg.color}
							name={seg.label}
						/>
					))}
				</BarChart>
			</ResponsiveContainer>
			<div className="legend">
				{SEGMENTS.map((seg) => (
					<span key={seg.key}>
						<span className="swatch" style={{ background: seg.color }} />
						{seg.label}
					</span>
				))}
			</div>
		</div>
	);
}
