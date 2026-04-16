import {
	type CSSProperties,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";
import {
	buttonAccent,
	buttonSmallAccent,
	buttonSmallSecondary,
	iconButtonBase,
} from "../../../components/styles.js";
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

interface SessionNotesPanelProps {
	campaignId: string;
	layout?: "panel" | "full";
}

export function SessionNotesPanel({
	campaignId,
	layout = "panel",
}: SessionNotesPanelProps) {
	const {
		activeSessionId,
		setActiveSessionId,
		expandNotesToFull,
		collapseNotesFromFull,
	} = useCampaignChrome();
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

	const updateMutateAsyncRef = useRef(updateMutation.mutateAsync);
	updateMutateAsyncRef.current = updateMutation.mutateAsync;

	const saveContent = useCallback(
		async (contentJson: string) => {
			if (!activeSessionId) return;
			await updateMutateAsyncRef.current({
				id: activeSessionId,
				content: contentJson,
			});
		},
		[activeSessionId],
	);

	const { saveState, scheduleSave } = useSessionAutoSave(saveContent);

	useEffect(() => {
		if (!activeSessionId && listQuery.data?.[0]) {
			setActiveSessionId(listQuery.data[0].id);
		}
	}, [activeSessionId, listQuery.data, setActiveSessionId]);

	const session = sessionQuery.data;

	const handleTitleCommit = useCallback(
		(raw: string) => {
			if (!session) return;
			const title = raw.trim() || null;
			if ((session.title ?? "") === (title ?? "")) return;
			updateMutation.mutate({ id: session.id, title });
		},
		[session, updateMutation],
	);

	const handleDateCommit = useCallback(
		(date: Date) => {
			if (!session || session.date.getTime() === date.getTime()) return;
			updateMutation.mutate({ id: session.id, date });
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
				<div
					style={{
						display: "flex",
						alignItems: "center",
						gap: "var(--space-2)",
						flexWrap: "wrap",
						minWidth: 0,
						flex: "1 1 auto",
					}}
				>
					{layout === "full" ? (
						<button
							type="button"
							style={buttonSmallSecondary}
							onClick={collapseNotesFromFull}
						>
							Back to panel
						</button>
					) : null}
					<SaveStatus saveState={saveState} />
				</div>
				<div
					style={{
						display: "flex",
						alignItems: "center",
						gap: "var(--space-2)",
						flexShrink: 0,
					}}
				>
					{layout === "panel" ? (
						<button
							type="button"
							title="Expand session notes to full width"
							aria-label="Expand session notes to full width"
							style={iconButtonBase}
							onClick={expandNotesToFull}
						>
							⤢
						</button>
					) : null}
					{isFinal ? (
						<button
							type="button"
							style={buttonSmallSecondary}
							onClick={() => setFinalizeOpen(true)}
						>
							Update
						</button>
					) : (
						<button
							type="button"
							style={buttonSmallAccent}
							onClick={() => setFinalizeOpen(true)}
						>
							Save Session
						</button>
					)}
				</div>
			</div>

			<div
				className={`finalize-form-reveal${finalizeOpen ? " finalize-form-reveal-open" : ""}`}
			>
				<div className="finalize-form-reveal-inner">
					{finalizeOpen ? (
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
					) : null}
				</div>
			</div>

			<div
				style={{
					flex: 1,
					minHeight: 0,
					display: "flex",
					flexDirection: "column",
					overflow: "auto",
				}}
			>
				<div
					style={
						layout === "full"
							? {
									width: "100%",
									maxWidth: "var(--sessionlog-max-width)",
									margin: "0 auto",
									padding: "var(--space-6) var(--space-5)",
									display: "flex",
									flexDirection: "column",
									flex: 1,
									minHeight: 0,
								}
							: {
									display: "flex",
									flexDirection: "column",
									flex: 1,
									minHeight: 0,
									padding: "var(--space-4)",
								}
					}
				>
					<SessionMetadataHost
						session={session}
						isFinal={isFinal}
						onTitleCommit={handleTitleCommit}
						onDateCommit={handleDateCommit}
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
				</div>
			</div>
		</div>
	);
}

/** Small adapter so the metadata block doesn't carry the panel/full padding decision. */
function SessionMetadataHost({
	session,
	isFinal,
	onTitleCommit,
	onDateCommit,
}: {
	session: {
		sessionNumber: number;
		title: string | null;
		date: Date;
	};
	isFinal: boolean;
	onTitleCommit: (title: string) => void;
	onDateCommit: (d: Date) => void;
}) {
	return (
		<SessionMetadata
			sessionNumber={session.sessionNumber}
			title={session.title}
			date={session.date}
			status={isFinal ? "finalized" : "draft"}
			onTitleCommit={onTitleCommit}
			onDateCommit={onDateCommit}
		/>
	);
}
