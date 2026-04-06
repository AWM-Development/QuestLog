import { type CSSProperties, useCallback, useEffect, useState } from "react";
import { buttonAccent, buttonSecondary } from "../../../components/styles.js";
import { useCampaignChrome } from "../../../layouts/CampaignChromeContext.js";
import { trpc } from "../../../lib/trpc.js";
import { useSessionAutoSave } from "../hooks/useSessionAutoSave.js";
import { FinalizeForm } from "./FinalizeForm.js";
import { SaveStatus } from "./SaveStatus.js";
import { SessionEditor } from "./SessionEditor.js";
import { SessionMetadata } from "./SessionMetadata.js";

const headerRow: CSSProperties = {
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	gap: "var(--space-2)",
	padding: "var(--space-3) var(--space-4)",
	borderBottom: "1px solid var(--border-subtle)",
	flexShrink: 0,
	flexWrap: "wrap",
};

const bannerStyle: CSSProperties = {
	padding: "var(--space-2) var(--space-4)",
	fontSize: "12px",
	color: "var(--text-muted)",
	backgroundColor: "var(--bg-elevated)",
	borderBottom: "1px solid var(--border-subtle)",
};

interface SessionNotesPanelProps {
	campaignId: string;
}

export function SessionNotesPanel({ campaignId }: SessionNotesPanelProps) {
	const { activeSessionId, setActiveSessionId } = useCampaignChrome();
	const [finalizeOpen, setFinalizeOpen] = useState(false);

	const listQuery = trpc.session.list.useQuery({ campaignId });
	const utils = trpc.useUtils();

	const sessionQuery = trpc.session.getById.useQuery(
		{ id: activeSessionId ?? "" },
		{ enabled: !!activeSessionId },
	);

	const createMutation = trpc.session.create.useMutation({
		onSuccess: (row) => {
			setActiveSessionId(row.id);
			void utils.session.list.invalidate({ campaignId });
		},
	});

	const updateMutation = trpc.session.update.useMutation({
		onSuccess: (_, v) => {
			void utils.session.getById.invalidate({ id: v.id });
			void utils.session.list.invalidate({ campaignId });
		},
	});

	const finalizeMutation = trpc.session.finalize.useMutation({
		onSuccess: (_, v) => {
			setFinalizeOpen(false);
			void utils.session.getById.invalidate({ id: v.id });
			void utils.session.list.invalidate({ campaignId });
		},
	});

	const saveContent = useCallback(
		async (contentJson: string) => {
			if (!activeSessionId) return;
			await updateMutation.mutateAsync({
				id: activeSessionId,
				content: contentJson,
			});
		},
		[activeSessionId, updateMutation],
	);

	const { saveState, scheduleSave } = useSessionAutoSave(saveContent);

	useEffect(() => {
		if (!activeSessionId && listQuery.data?.[0]) {
			setActiveSessionId(listQuery.data[0].id);
		}
	}, [activeSessionId, listQuery.data, setActiveSessionId]);

	const session = sessionQuery.data;

	const handleMetaUpdate = useCallback(
		(patch: {
			title?: string | null;
			sessionNumber?: number;
			date?: Date;
		}) => {
			if (!session) return;
			updateMutation.mutate({
				id: session.id,
				...patch,
			});
		},
		[session, updateMutation],
	);

	if (listQuery.isLoading) {
		return (
			<div style={{ padding: "var(--space-4)", color: "var(--text-muted)" }}>
				Loading sessions…
			</div>
		);
	}

	if (listQuery.isSuccess && listQuery.data.length === 0) {
		return (
			<div
				style={{
					padding: "var(--space-6)",
					display: "flex",
					flexDirection: "column",
					gap: "var(--space-4)",
					alignItems: "flex-start",
				}}
			>
				<p
					style={{
						margin: 0,
						color: "var(--text-secondary)",
						fontSize: "0.875rem",
					}}
				>
					No sessions yet. Start a session log to capture what happens at the
					table.
				</p>
				<button
					type="button"
					style={buttonAccent}
					onClick={() => createMutation.mutate({ campaignId })}
					disabled={createMutation.isPending}
				>
					+ New Session
				</button>
			</div>
		);
	}

	if (!activeSessionId || sessionQuery.isLoading || !session) {
		return (
			<div style={{ padding: "var(--space-4)", color: "var(--text-muted)" }}>
				Loading session…
			</div>
		);
	}

	const isFinal = session.status === "finalized";

	return (
		<div
			style={{
				display: "flex",
				flexDirection: "column",
				height: "100%",
				minHeight: 0,
			}}
		>
			<div style={headerRow}>
				<span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
					{isFinal ? "✓" : "📝"} Session {session.sessionNumber} ·{" "}
					{isFinal ? (session.title ?? "Untitled") : "draft"}
				</span>
				{isFinal ? (
					<button
						type="button"
						style={{
							...buttonSecondary,
							padding: "4px 12px",
							fontSize: "0.75rem",
						}}
						onClick={() => setFinalizeOpen(true)}
					>
						Update
					</button>
				) : (
					<button
						type="button"
						style={{
							...buttonAccent,
							padding: "4px 12px",
							fontSize: "0.75rem",
						}}
						onClick={() => setFinalizeOpen(true)}
					>
						Save Session
					</button>
				)}
			</div>

			{isFinal && (
				<div style={bannerStyle}>
					This session has been saved. Edits will be re-processed.
				</div>
			)}

			{finalizeOpen && (
				<FinalizeForm
					initialTitle={session.title}
					initialSessionNumber={session.sessionNumber}
					initialDate={session.date}
					initialSummary={session.summary}
					initialTags={session.tags ?? []}
					isSubmitting={finalizeMutation.isPending}
					onCancel={() => setFinalizeOpen(false)}
					onConfirm={(data) => {
						finalizeMutation.mutate({
							id: session.id,
							title: data.title,
							summary: data.summary,
							tags: data.tags,
							sessionNumber: data.sessionNumber,
							date: data.date,
						});
					}}
				/>
			)}

			<SessionMetadata
				sessionNumber={session.sessionNumber}
				title={session.title}
				date={session.date}
				onTitleCommit={(title) =>
					handleMetaUpdate({ title: title.trim() || null })
				}
				onSessionNumberChange={(sessionNumber) =>
					handleMetaUpdate({ sessionNumber })
				}
				onDateChange={(date) => handleMetaUpdate({ date })}
			/>

			<div
				style={{
					flex: 1,
					minHeight: 0,
					display: "flex",
					flexDirection: "column",
				}}
			>
				<SessionEditor
					key={session.id}
					sessionId={session.id}
					content={session.content}
					placeholder="Start writing your session notes here. Type / for formatting options."
					onContentChange={(json) => {
						scheduleSave(json);
					}}
				/>
			</div>

			<div
				style={{
					padding: "var(--space-2) var(--space-4)",
					borderTop: "1px solid var(--border-subtle)",
					flexShrink: 0,
				}}
			>
				<SaveStatus saveState={saveState} />
			</div>
		</div>
	);
}
