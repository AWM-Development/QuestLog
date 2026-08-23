import { COMPLEXITY_TIERS, type ComplexityTier } from "@questlog/shared";
import { formatCost, formatTokens } from "../utils/format.js";
import type { TierStats } from "../utils/stats.js";

interface TierRowProps {
	byTier: Record<ComplexityTier, TierStats>;
}

export function TierRow({ byTier }: TierRowProps) {
	return (
		<div className="tier-row">
			{COMPLEXITY_TIERS.map((tier) => {
				const stats = byTier[tier];
				return (
					<div key={tier} className="tier-tile">
						<span className={`tag tag-tier-${tier}`}>{tier.toUpperCase()}</span>
						<div className="stats">
							<div>
								<div className="mini-label">Avg Cost</div>
								<div className="mini-value">{formatCost(stats.avgCost)}</div>
							</div>
							<div>
								<div className="mini-label">Avg Tokens</div>
								<div className="mini-value">
									{formatTokens(stats.avgTokens)}
								</div>
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
