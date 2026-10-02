import type { TicketCard } from "@questlog/shared";
import { BOARD_COLUMNS, extractDependencyChips } from "../utils/columns.js";
import { ChipView } from "./DependencyChips.js";
import { priorityClass, tierClass } from "./TicketCardView.js";

export function TicketModal({
	card,
	onClose,
}: {
	card: TicketCard;
	onClose: () => void;
}) {
	const chips = extractDependencyChips(card);
	const columnName =
		BOARD_COLUMNS.find((c) => c.status === card.status)?.name ?? card.status;
	return (
		// biome-ignore lint/a11y/useKeyWithClickEvents: Escape-to-close is handled by the dialog's own button; backdrop click is a pointer convenience
		<div
			className="modal-backdrop"
			data-testid="modal-backdrop"
			onClick={onClose}
		>
			{/* biome-ignore lint/a11y/useKeyWithClickEvents: stops backdrop-close from firing on in-modal clicks */}
			<dialog
				open
				className="modal"
				aria-modal="true"
				aria-label={card.title}
				onClick={(e) => e.stopPropagation()}
			>
				<div className="modal-head">
					<div>
						<div className="id-row">
							<span className="card-id">{card.id}</span>
							{card.complexityTier && (
								<span className={tierClass(card.complexityTier)}>
									{card.complexityTier}
								</span>
							)}
							{card.priority && (
								<span className={priorityClass(card.priority)}>
									{card.priority}
								</span>
							)}
						</div>
						<h2>{card.title}</h2>
					</div>
					<button
						type="button"
						className="modal-close"
						aria-label="Close"
						onClick={onClose}
					>
						<svg
							width="16"
							height="16"
							viewBox="0 0 16 16"
							fill="none"
							stroke="currentColor"
							strokeWidth="1.5"
							strokeLinecap="round"
							aria-hidden="true"
						>
							<path d="M3 3l10 10M13 3L3 13" />
						</svg>
					</button>
				</div>
				<div className="modal-row">
					<div className="field">
						<div className="k">Column</div>
						<div className="v">{columnName}</div>
					</div>
				</div>
				{card.branch && (
					<div className="modal-row">
						<div className="field">
							<div className="k">Branch</div>
							<div className="v mono-v">{card.branch}</div>
						</div>
					</div>
				)}
				{chips.length > 0 && (
					<div className="modal-section">
						<div className="k">Dependencies</div>
						<div className="modal-chip-row">
							{chips.map((c) => (
								<ChipView key={`${c.kind}-${c.label}`} chip={c} />
							))}
						</div>
					</div>
				)}
				{card.scopeExcerpt && (
					<div className="modal-section">
						<div className="k">Scope</div>
						<div className="v">{card.scopeExcerpt}</div>
					</div>
				)}
			</dialog>
		</div>
	);
}
