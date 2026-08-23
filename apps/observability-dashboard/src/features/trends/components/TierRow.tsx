import { fmtCost, fmtTokens } from "../lib/format.js";
import type { TierStats } from "../lib/stats.js";

interface TierRowProps {
	byTier: Record<"s" | "m" | "l", TierStats>;
}

const TIER_ORDER = ["s", "m", "l"] as const;

export function TierRow({ byTier }: TierRowProps) {
	return (
		<div className="tier-row">
			{TIER_ORDER.map((tier) => {
				const stats = byTier[tier];
				return (
					<div key={tier} className="tier-tile">
						<span className={`tag tag-tier-${tier}`}>{tier.toUpperCase()}</span>
						<div className="stats">
							<div>
								<div className="mini-label">Avg Cost</div>
								<div className="mini-value">{fmtCost(stats.avgCost)}</div>
							</div>
							<div>
								<div className="mini-label">Avg Tokens</div>
								<div className="mini-value">{fmtTokens(stats.avgTokens)}</div>
							</div>
							<div>
								<div className="mini-label">Runs</div>
								<div className="mini-value">{stats.runCount}</div>
							</div>
						</div>
					</div>
				);
			})}
		</div>
	);
}
