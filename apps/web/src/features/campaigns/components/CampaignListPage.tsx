import { buttonAccent } from "@/components/styles.js";
import { trpc } from "@/lib/trpc.js";
import { useState } from "react";
import { Link } from "react-router";
import { CampaignCreateModal } from "./CampaignCreateModal.js";

export function CampaignListPage() {
	const [showCreate, setShowCreate] = useState(false);
	const campaignsQuery = trpc.campaign.list.useQuery(undefined, {
		retry: 1,
		retryDelay: 500,
	});

	return (
		<div>
			<div
				style={{
					display: "flex",
					justifyContent: "space-between",
					alignItems: "center",
					marginBottom: "var(--spacing-xl)",
				}}
			>
				<h1
					style={{
						fontFamily: "var(--font-heading)",
						fontSize: "1.75rem",
						fontWeight: 700,
						color: "var(--color-text-primary)",
					}}
				>
					Campaigns
				</h1>
				<button
					type="button"
					onClick={() => setShowCreate(true)}
					style={buttonAccent}
				>
					New Campaign
				</button>
			</div>

			{campaignsQuery.isLoading && <CampaignListSkeleton />}

			{campaignsQuery.isError && (
				<div
					role="alert"
					style={{
						backgroundColor: "var(--color-bg-surface)",
						borderRadius: "var(--radius-md)",
						padding: "var(--spacing-xl)",
						textAlign: "center",
						color: "var(--color-error)",
					}}
				>
					<p style={{ fontWeight: 600, marginBottom: "var(--spacing-sm)" }}>
						Failed to load campaigns
					</p>
					<p
						style={{
							fontSize: "0.875rem",
							color: "var(--color-text-muted)",
							marginBottom: "var(--spacing-lg)",
						}}
					>
						Could not connect to the server. Make sure the API is running.
					</p>
					<button
						type="button"
						onClick={() => campaignsQuery.refetch()}
						style={buttonAccent}
					>
						Retry
					</button>
				</div>
			)}

			{campaignsQuery.isSuccess && campaignsQuery.data.length === 0 && (
				<div
					style={{
						backgroundColor: "var(--color-bg-surface)",
						borderRadius: "var(--radius-md)",
						padding: "var(--spacing-2xl)",
						textAlign: "center",
					}}
				>
					<p
						style={{
							fontSize: "1.25rem",
							fontFamily: "var(--font-heading)",
							color: "var(--color-text-primary)",
							marginBottom: "var(--spacing-sm)",
						}}
					>
						No campaigns yet
					</p>
					<p
						style={{
							color: "var(--color-text-muted)",
							marginBottom: "var(--spacing-lg)",
							fontSize: "0.875rem",
						}}
					>
						Create your first campaign to get started.
					</p>
					<button
						type="button"
						onClick={() => setShowCreate(true)}
						style={buttonAccent}
					>
						Create Campaign
					</button>
				</div>
			)}

			{campaignsQuery.isSuccess && campaignsQuery.data.length > 0 && (
				<div
					style={{
						display: "grid",
						gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
						gap: "var(--spacing-lg)",
					}}
				>
					{campaignsQuery.data.map((campaign) => (
						<CampaignCard key={campaign.id} campaign={campaign} />
					))}
				</div>
			)}

			{showCreate && (
				<CampaignCreateModal onClose={() => setShowCreate(false)} />
			)}
		</div>
	);
}

function CampaignListSkeleton() {
	return (
		<div
			aria-label="Loading campaigns"
			style={{
				display: "grid",
				gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
				gap: "var(--spacing-lg)",
			}}
		>
			{[1, 2, 3].map((i) => (
				<div
					key={i}
					style={{
						backgroundColor: "var(--color-bg-surface)",
						borderRadius: "var(--radius-md)",
						padding: "var(--spacing-lg)",
						height: 140,
						animation: "pulse 2s ease-in-out infinite",
					}}
				/>
			))}
		</div>
	);
}

interface CampaignCardProps {
	campaign: {
		id: string;
		name: string;
		theme: string;
		gameSystem: string | null;
		status: string;
		description: string | null;
	};
}

function CampaignCard({ campaign }: CampaignCardProps) {
	return (
		<Link
			to={`/campaign/${campaign.id}`}
			style={{
				display: "block",
				backgroundColor: "var(--color-bg-surface)",
				borderRadius: "var(--radius-md)",
				padding: "var(--spacing-lg)",
				textDecoration: "none",
				color: "inherit",
				border: "1px solid var(--color-border-subtle)",
				cursor: "pointer",
				transition: "background-color 0.15s, border-color 0.15s",
			}}
			onMouseEnter={(e) => {
				e.currentTarget.style.backgroundColor = "var(--color-bg-surface-hover)";
				e.currentTarget.style.borderColor = "var(--color-border)";
			}}
			onMouseLeave={(e) => {
				e.currentTarget.style.backgroundColor = "var(--color-bg-surface)";
				e.currentTarget.style.borderColor = "var(--color-border-subtle)";
			}}
		>
			<h2
				style={{
					fontFamily: "var(--font-heading)",
					fontSize: "1.125rem",
					fontWeight: 600,
					marginBottom: "var(--spacing-sm)",
					color: "var(--color-text-primary)",
				}}
			>
				{campaign.name}
			</h2>
			{campaign.description && (
				<p
					style={{
						fontSize: "0.875rem",
						color: "var(--color-text-secondary)",
						marginBottom: "var(--spacing-md)",
						lineHeight: 1.5,
						overflow: "hidden",
						display: "-webkit-box",
						WebkitLineClamp: 2,
						WebkitBoxOrient: "vertical",
					}}
				>
					{campaign.description}
				</p>
			)}
			<div
				style={{
					display: "flex",
					gap: "var(--spacing-md)",
					fontSize: "0.75rem",
					color: "var(--color-text-muted)",
				}}
			>
				<span
					style={{
						backgroundColor: "var(--color-accent-muted)",
						color: "var(--color-accent)",
						padding: "2px 8px",
						borderRadius: "var(--radius-sm)",
					}}
				>
					{campaign.theme}
				</span>
				{campaign.gameSystem && <span>{campaign.gameSystem}</span>}
				<span
					style={{
						marginLeft: "auto",
						textTransform: "capitalize",
					}}
				>
					{campaign.status}
				</span>
			</div>
		</Link>
	);
}
