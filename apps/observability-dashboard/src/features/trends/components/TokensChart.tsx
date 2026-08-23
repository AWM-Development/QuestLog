import {
	Bar,
	BarChart,
	CartesianGrid,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import type { TrendRun } from "../utils/types.js";

interface TokensChartProps {
	runs: TrendRun[];
}

// cache-read has no equivalent in design-tokens.css — a documented one-off,
// not a token, since nothing else in this app needs a 4th chart-only hue.
const CACHE_READ_COLOR = "#c0a0ff";

const SEGMENTS = [
	{ key: "inputTokens", label: "input", color: "var(--text-dim)" },
	{ key: "outputTokens", label: "output", color: "var(--accent)" },
	{
		key: "cacheCreationInputTokens",
		label: "cache-write",
		color: "var(--status-success)",
	},
	{ key: "cacheReadInputTokens", label: "cache-read", color: CACHE_READ_COLOR },
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
				input / output / cache-write / cache-read, most recent runs
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
