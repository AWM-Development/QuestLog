import { useState } from "react";
import { DrillDownGridRow } from "./DrillDownGridRow.js";
import { fmtCost, fmtTokens, fmtTurns } from "./format.js";
import { runCost, totalTokens } from "./stats.js";
import type { TrendRun } from "./types.js";

function fmtDuration(ms: number): string {
	const totalSeconds = Math.round(ms / 1000);
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
}

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
				<DrillDownGridRow
					data-testid="dd-row"
					className="dd-row-summary"
					style={{ padding: "var(--space-2) var(--space-3)", fontSize: "12px" }}
				>
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
				<div
					data-testid={`dd-detail-${run.ticketId}`}
					className="expand-body"
					style={{
						background: "var(--bg-focal)",
						borderRadius: "var(--r-md)",
						padding: "var(--space-3)",
						margin: "var(--space-2) var(--space-3) var(--space-3)",
						fontSize: "12px",
						color: "var(--text-secondary)",
					}}
				>
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
			<DrillDownGridRow
				data-testid="dd-header"
				className="dd-header"
				style={{
					color: "var(--text-muted)",
					fontWeight: 500,
					fontSize: "11px",
					padding: "var(--space-2) var(--space-3)",
					borderBottom: "0.5px solid var(--border)",
				}}
			>
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
							// Keyed by createdAt rather than a shared literal — more than
							// one empty run can fall in the selected date range, and a
							// literal key here would collapse them to a single React
							// element, silently dropping every empty-run row but the last.
							key={`empty-${String(run.createdAt)}`}
							className="empty-row"
							style={{
								color: "var(--text-dim)",
								fontStyle: "italic",
								padding: "var(--space-2) var(--space-3)",
								fontSize: "12px",
							}}
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
