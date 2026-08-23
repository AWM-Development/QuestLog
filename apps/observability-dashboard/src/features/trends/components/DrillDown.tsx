import { useState } from "react";
import { fmtCost, fmtDuration, fmtTokens, fmtTurns } from "../utils/format.js";
import { runCost, totalTokens } from "../utils/stats.js";
import type { TrendRun } from "../utils/types.js";
import { DrillDownGridRow } from "./DrillDownGridRow.js";

function DrillDownRow({ run }: { run: TrendRun }) {
	const [expanded, setExpanded] = useState(false);
	if (!run.ticketId) return null; // non-empty rows always carry a ticketId
	// Computed once and reused below in both the summary row and the
	// expanded detail, rather than re-derived from the same `run` twice.
	const cost = fmtCost(runCost(run));
	const duration = fmtDuration(run.durationMs);
	const tokens = fmtTokens(totalTokens(run));

	return (
		<div>
			<button
				type="button"
				data-testid={`dd-row-summary-${run.ticketId}`}
				onClick={() => setExpanded((v) => !v)}
				style={{
					all: "unset",
					display: "block",
					width: "100%",
					cursor: "pointer",
				}}
			>
				<DrillDownGridRow data-testid="dd-row" className="dd-row-summary">
					<div>
						<span className="mono">{run.ticketId}</span>
					</div>
					<div>
						{run.complexityTier ? (
							<span className={`tag tag-tier-${run.complexityTier}`}>
								{run.complexityTier.toUpperCase()}
							</span>
						) : null}
					</div>
					<div className="num">{cost}</div>
					<div className="num">{tokens}</div>
					<div className="num">{duration}</div>
					<div className="num">
						{run.turnsToGreen !== null ? fmtTurns(run.turnsToGreen) : "—"}
					</div>
					<div className="num">—</div>
					<div style={{ textAlign: "right", color: "var(--text-muted)" }}>
						{expanded ? "▴" : "▾"}
					</div>
				</DrillDownGridRow>
			</button>
			{expanded ? (
				<div data-testid={`dd-detail-${run.ticketId}`} className="expand-body">
					Duration: {duration} · Cost: {cost} · Tokens: {tokens}
				</div>
			) : null}
		</div>
	);
}

interface DrillDownProps {
	runs: TrendRun[];
}

/**
 * Per-ticket drill-down table. Header and every row are built from the same
 * `DrillDownGridRow` component so their column widths can never drift apart
 * — see `DrillDownGridRow.tsx`'s docstring for the bug this avoids.
 */
export function DrillDown({ runs }: DrillDownProps) {
	return (
		<div className="panel">
			<div className="section-title">Per-Ticket Drill-Down</div>
			<div className="section-sub">
				Click a row to expand full metrics for that run
			</div>
			<DrillDownGridRow data-testid="dd-header" className="dd-header">
				<div>Ticket</div>
				<div>Tier</div>
				<div className="num">Cost</div>
				<div className="num">Tokens</div>
				<div className="num">Duration</div>
				<div className="num">Turns→Green</div>
				<div className="num">Retries</div>
				<div />
			</DrillDownGridRow>
			<div>
				{runs.map((run) =>
					run.emptyRun ? (
						<div
							// createdAt, not a shared literal — multiple empty runs in one range would otherwise collapse to a single React element.
							key={`empty-${String(run.createdAt)}`}
							className="empty-row"
						>
							No ticket picked up — empty_run: true (filtered out by default,
							toggle "Exclude Empty Runs" off to include)
						</div>
					) : (
						<DrillDownRow key={run.ticketId} run={run} />
					),
				)}
			</div>
		</div>
	);
}
