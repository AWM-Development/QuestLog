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
					marginBottom: "var(--space-8)",
				}}
			>
				<h1
					style={{
						fontFamily: "var(--font-display)",
						fontSize: "1.75rem",
						fontWeight: 700,
						color: "var(--text-primary)",
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
						backgroundColor: "var(--bg-elevated)",
						borderRadius: "var(--r-md)",
						padding: "var(--space-8)",
						textAlign: "center",
						color: "var(--status-error)",
					}}
				>
					<p style={{ fontWeight: 600, marginBottom: "var(--space-2)" }}>
						Failed to load campaigns
					</p>
					<p
						style={{
							fontSize: "0.875rem",
							color: "var(--text-muted)",
							marginBottom: "var(--space-6)",
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
						backgroundColor: "var(--bg-elevated)",
						borderRadius: "var(--r-md)",
						padding: "var(--space-8)",
						textAlign: "center",
					}}
				>
					<p
						style={{
							fontSize: "1.25rem",
							fontFamily: "var(--font-display)",
							color: "var(--text-primary)",
							marginBottom: "var(--space-2)",
						}}
					>
						No campaigns yet
					</p>
					<p
						style={{
							color: "var(--text-muted)",
							marginBottom: "var(--space-6)",
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
						gap: "var(--space-6)",
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
				gap: "var(--space-6)",
			}}
		>
			{[1, 2, 3].map((i) => (
				<div
					key={i}
					style={{
						backgroundColor: "var(--bg-elevated)",
						borderRadius: "var(--r-md)",
						padding: "var(--space-6)",
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
				backgroundColor: "var(--bg-elevated)",
				borderRadius: "var(--r-md)",
				padding: "var(--space-6)",
				textDecoration: "none",
				color: "inherit",
				border: "1px solid var(--border-subtle)",
				cursor: "pointer",
				transition: "background-color 0.15s, border-color 0.15s",
			}}
			onMouseEnter={(e) => {
				e.currentTarget.style.backgroundColor = "var(--bg-focal)";
				e.currentTarget.style.borderColor = "var(--border)";
			}}
			onMouseLeave={(e) => {
				e.currentTarget.style.backgroundColor = "var(--bg-elevated)";
				e.currentTarget.style.borderColor = "var(--border-subtle)";
			}}
		>
			<h2
				style={{
					fontFamily: "var(--font-display)",
					fontSize: "1.125rem",
					fontWeight: 600,
					marginBottom: "var(--space-2)",
					color: "var(--text-primary)",
				}}
			>
				{campaign.name}
			</h2>
			{campaign.description && (
				<p
					style={{
						fontSize: "0.875rem",
						color: "var(--text-secondary)",
						marginBottom: "var(--space-4)",
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
					gap: "var(--space-4)",
					fontSize: "0.75rem",
					color: "var(--text-muted)",
				}}
			>
				<span
					style={{
						backgroundColor: "var(--accent-muted)",
						color: "var(--accent)",
						padding: "2px 8px",
						borderRadius: "var(--r-sm)",
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
