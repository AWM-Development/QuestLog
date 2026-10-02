import type { TicketCard } from "@questlog/shared";
import { useState } from "react";
import { trpc } from "../../../lib/trpc.js";
import { BOARD_COLUMNS, groupByStatus } from "../utils/columns.js";
import { TicketCardView } from "./TicketCardView.js";
import { TicketModal } from "./TicketModal.js";

/**
 * One shared fixed-width style for every column, so no column can size
 * itself independently of the others — the same structural guard
 * DrillDownGridRow.tsx's shared template gives the Trends drill-down
 * (T-057). The board row scrolls horizontally when the viewport is narrower
 * than six columns rather than wrapping.
 */
export const BOARD_COLUMN_STYLE = {
	flex: "0 0 240px",
	width: "240px",
} as const;

function BoardError({ onRetry }: { onRetry: () => void }) {
	return (
		<div className="board-error">
			<div className="headline">Couldn't load the board</div>
			<div className="sub">
				The GitHub API read behind board.list didn't respond. Trends and Log are
				unaffected.
			</div>
			<button type="button" className="btn-secondary" onClick={onRetry}>
				Retry
			</button>
		</div>
	);
}

export function BoardPage() {
	const { data, isLoading, isError, refetch } = trpc.board.list.useQuery();
	const [selected, setSelected] = useState<TicketCard | null>(null);

	let body: React.ReactNode;
	if (isError) {
		body = <BoardError onRetry={() => refetch()} />;
	} else if (isLoading || !data) {
		body = (
			<div className="board">
				{BOARD_COLUMNS.map((col) => (
					<div
						key={col.status}
						className="column"
						style={BOARD_COLUMN_STYLE}
						data-testid={`column-${col.status}`}
					>
						<div className="column-head">
							<span className="name">{col.name}</span>
						</div>
						<div className="column-body">
							{[0, 1, 2].map((i) => (
								<div
									key={i}
									className="skeleton-card"
									data-testid="skeleton-card"
								/>
							))}
						</div>
					</div>
				))}
			</div>
		);
	} else {
		const grouped = groupByStatus(data);
		body = (
			<div className="board">
				{BOARD_COLUMNS.map((col) => {
					const cards = grouped[col.status];
					return (
						<div
							key={col.status}
							className="column"
							style={BOARD_COLUMN_STYLE}
							data-col={col.status}
							data-testid={`column-${col.status}`}
						>
							<div className="column-head">
								<span className="name">{col.name}</span>
								<span className="count">{cards.length}</span>
							</div>
							<div className="column-body">
								{cards.length === 0 ? (
									<div className="col-empty">
										<div className="headline">{col.emptyHeadline}</div>
										<div className="sub">{col.emptySub}</div>
									</div>
								) : (
									cards.map((card) => (
										<TicketCardView
											key={card.id}
											card={card}
											onOpen={setSelected}
										/>
									))
								)}
							</div>
						</div>
					);
				})}
			</div>
		);
	}

	return (
		<div className="page-body page-body-wide">
			<div className="board-toolbar">
				<p className="section-title">Ticket board</p>
				<p className="section-sub">
					Live view of Docs/tickets/ on develop (read-only).
				</p>
			</div>
			{body}
			{selected && (
				<TicketModal card={selected} onClose={() => setSelected(null)} />
			)}
		</div>
	);
}
