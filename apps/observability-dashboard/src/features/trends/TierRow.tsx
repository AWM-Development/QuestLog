import { fmtCost, fmtTokens } from "./format.js";
import type { TierStats } from "./stats.js";

interface TierRowProps {
	byTier: Record<"s" | "m" | "l", TierStats>;
}

const TIER_ORDER = ["s", "m", "l"] as const;

export function TierRow({ byTier }: TierRowProps) {
	return (
		<div
			className="tier-row"
			style={{
				display: "grid",
				gridTemplateColumns: "repeat(3, 1fr)",
				gap: "var(--space-3)",
				marginBottom: "var(--space-6)",
			}}
		>
			{TIER_ORDER.map((tier) => {
				const stats = byTier[tier];
				return (
					<div
						key={tier}
						className="tier-tile"
						style={{
							background: "var(--bg-elevated)",
							border: "0.5px solid var(--border)",
							borderRadius: "var(--r-md)",
							padding: "var(--space-3)",
							display: "flex",
							alignItems: "center",
							gap: "var(--space-3)",
						}}
					>
						<span className={`tag tag-tier-${tier}`}>{tier.toUpperCase()}</span>
						<div style={{ display: "flex", gap: "var(--space-4)" }}>
							<div>
								<div className="mini-label" style={miniLabelStyle}>
									Avg Cost
								</div>
								<div className="mini-value" style={miniValueStyle}>
									{fmtCost(stats.avgCost)}
								</div>
							</div>
							<div>
								<div className="mini-label" style={miniLabelStyle}>
									Avg Tokens
								</div>
								<div className="mini-value" style={miniValueStyle}>
									{fmtTokens(stats.avgTokens)}
								</div>
							</div>
							<div>
								<div className="mini-label" style={miniLabelStyle}>
									Runs
								</div>
								<div className="mini-value" style={miniValueStyle}>
									{stats.runCount}
								</div>
							</div>
						</div>
					</div>
				);
			})}
		</div>
	);
}

const miniLabelStyle = {
	fontSize: "9px",
	color: "var(--text-muted)",
	textTransform: "uppercase" as const,
	letterSpacing: "0.03em",
};

const miniValueStyle = {
	fontFamily: "var(--font-mono)",
	fontSize: "13px",
	color: "var(--text-primary)",
};
