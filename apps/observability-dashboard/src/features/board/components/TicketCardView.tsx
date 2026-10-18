import type { TicketCard } from "@questlog/shared";
import { extractDependencyChips } from "../utils/columns.js";
import { ChipRow } from "./DependencyChips.js";

export function priorityClass(priority: string): string {
	return `priority priority-${priority.toLowerCase()}`;
}

export function tierClass(tier: string): string {
	return `tag tag-tier-${tier.toLowerCase()}`;
}

export function TicketCardView({
	card,
	onOpen,
}: {
	card: TicketCard;
	onOpen: (card: TicketCard) => void;
}) {
	return (
		<button type="button" className="card" onClick={() => onOpen(card)}>
			<span className="card-top">
				<span className="card-id">{card.id}</span>
				<span className="card-top-spacer" />
				{card.complexityTier && (
					<span className={tierClass(card.complexityTier)}>
						{card.complexityTier}
					</span>
				)}
			</span>
			<span className="card-title">{card.title}</span>
			{card.scopeExcerpt && (
				<span className="card-scope">{card.scopeExcerpt}</span>
			)}
			{card.priority && (
				<span className="card-meta">
					<span className={priorityClass(card.priority)}>{card.priority}</span>
				</span>
			)}
			<ChipRow chips={extractDependencyChips(card)} />
		</button>
	);
}
