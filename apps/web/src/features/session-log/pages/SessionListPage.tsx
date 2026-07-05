import { useNavigate, useParams } from "react-router";
import { Button } from "../../../components/buttons/Button.js";
import {
	PageContainer,
	PageHeader,
} from "../../../components/layout/PageScaffold.js";
import { Card } from "../../../components/surfaces/Card.js";
import { trpc } from "../../../lib/trpc.js";

export function SessionListPage() {
	const { id: campaignId } = useParams<{ id: string }>();
	const navigate = useNavigate();

	const listQuery = trpc.session.list.useQuery(
		{ campaignId: campaignId ?? "" },
		{ enabled: !!campaignId },
	);

	const createMutation = trpc.session.create.useMutation({
		onSuccess: (row) => {
			void navigate(`/campaign/${campaignId}/sessions/${row.id}`);
		},
	});

	if (!campaignId) {
		return null;
	}

	return (
		<PageContainer>
			<PageHeader
				title="Session logs"
				subtitle="Capture what happens at the table. Open the notes panel from the header or ⌘⇧N."
				actions={
					<Button
						variant="accent"
						onClick={() => createMutation.mutate({ campaignId })}
						disabled={createMutation.isPending}
					>
						+ New Session
					</Button>
				}
			/>

			{listQuery.isLoading && (
				<p style={{ color: "var(--text-muted)" }}>Loading…</p>
			)}

			{listQuery.isSuccess && listQuery.data.length === 0 && (
				<div
					style={{
						display: "flex",
						flexDirection: "column",
						gap: "var(--space-4)",
						alignItems: "flex-start",
					}}
				>
					<p style={{ color: "var(--text-secondary)", margin: 0 }}>
						No sessions yet. Start your first session log to capture what
						happens at the table.
					</p>
					<Button
						variant="accent"
						onClick={() => createMutation.mutate({ campaignId })}
						disabled={createMutation.isPending}
					>
						+ New Session
					</Button>
				</div>
			)}

			{listQuery.isSuccess && listQuery.data.length > 0 && (
				<div
					style={{
						display: "flex",
						flexDirection: "column",
						gap: "var(--space-3)",
					}}
				>
					{listQuery.data.map((s) => (
						<Card
							key={s.id}
							as="button"
							hoverable
							style={{
								padding: "var(--space-4)",
								display: "flex",
								flexDirection: "column",
								gap: "var(--space-2)",
								textAlign: "left",
								width: "100%",
							}}
							onClick={() => {
								void navigate(`/campaign/${campaignId}/sessions/${s.id}`);
							}}
						>
							<span
								style={{
									fontFamily: "var(--font-mono)",
									fontSize: "0.75rem",
									color: "var(--text-muted)",
								}}
							>
								Session {s.sessionNumber}
							</span>
							<span
								style={{
									fontFamily: "var(--font-display)",
									fontSize: "1.05rem",
									fontWeight: 600,
								}}
							>
								{s.title?.trim() ? s.title : "Untitled session"}
							</span>
							<span
								style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}
							>
								{s.date.toLocaleDateString()} · {s.status}
							</span>
							{s.summary ? (
								<span
									style={{
										fontSize: "0.8125rem",
										color: "var(--text-secondary)",
										overflow: "hidden",
										textOverflow: "ellipsis",
										display: "-webkit-box",
										WebkitLineClamp: 2,
										WebkitBoxOrient: "vertical",
									}}
								>
									{s.summary}
								</span>
							) : null}
						</Card>
					))}
				</div>
			)}
		</PageContainer>
	);
}
