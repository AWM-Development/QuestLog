import { Button } from "@/components/Button.js";
import { Card } from "@/components/Card.js";
import { Alert } from "@/components/feedback/Alert.js";
import { PageContainer, PageHeader } from "@/components/layout/PageScaffold.js";
import { Chip } from "@/components/primitives/Chip.js";
import { trpc } from "@/lib/trpc.js";
import { useState } from "react";
import { CampaignCreateModal } from "./CampaignCreateModal.js";

export function CampaignListPage() {
	const [showCreate, setShowCreate] = useState(false);
	const campaignsQuery = trpc.campaign.list.useQuery(undefined, {
		retry: 1,
		retryDelay: 500,
	});

	return (
		<PageContainer style={{ maxWidth: "1080px" }}>
			<PageHeader
				title="Campaigns"
				actions={
					<Button variant="accent" onClick={() => setShowCreate(true)}>
						New Campaign
					</Button>
				}
			/>

			{campaignsQuery.isLoading && <CampaignListSkeleton />}

			{campaignsQuery.isError && (
				<Alert
					title="Failed to load campaigns"
					onRetry={() => void campaignsQuery.refetch()}
				>
					Could not connect to the server. Make sure the API is running.
				</Alert>
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
					<Button variant="accent" onClick={() => setShowCreate(true)}>
						Create Campaign
					</Button>
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
		</PageContainer>
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
		<Card
			as="link"
			href={`/campaign/${campaign.id}`}
			hoverable
			style={{ display: "block", padding: "var(--space-6)" }}
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
				<Chip variant="badge">{campaign.theme}</Chip>
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
		</Card>
	);
}
