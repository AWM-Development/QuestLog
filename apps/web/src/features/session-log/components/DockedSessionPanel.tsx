import { type CSSProperties, useCallback, useRef, useState } from "react";
import { useNavigate } from "react-router";
import {
	buttonAccent,
	buttonGhost,
	buttonSecondary,
	iconButtonBase,
} from "../../../components/styles.js";
import { useCampaignChrome } from "../../../layouts/CampaignChromeContext.js";
import { trpc } from "../../../lib/trpc.js";
import { useSessionAutoSave } from "../hooks/useSessionAutoSave.js";
import { FinalizeForm } from "./FinalizeForm.js";
import { SaveStatus } from "./SaveStatus.js";
import { SessionEditor } from "./SessionEditor.js";
import { SessionMetadata } from "./SessionMetadata.js";

const dockShell: CSSProperties = {
	display: "flex",
	flexDirection: "column",
	height: "100vh",
	minWidth: 0,
	backgroundColor: "var(--bg-surface)",
	borderLeft: "1px solid var(--border-subtle)",
	overflow: "hidden",
};

const dockHeader: CSSProperties = {
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	gap: "var(--space-2)",
	padding: "var(--space-3) var(--space-3)",
	borderBottom: "1px solid var(--border-subtle)",
	flexShrink: 0,
};

const dockHeaderGroup: CSSProperties = {
	display: "flex",
	alignItems: "center",
	gap: "var(--space-2)",
	minWidth: 0,
};

interface DockedSessionPanelProps {
	campaignId: string;
}

export function DockedSessionPanel({ campaignId }: DockedSessionPanelProps) {
	const { activeSessionId, undock } = useCampaignChrome();
	const navigate = useNavigate();
	const [finalizeOpen, setFinalizeOpen] = useState(false);

	const sessionQuery = trpc.session.getById.useQuery(
		{ id: activeSessionId ?? "" },
		{ enabled: !!activeSessionId },
	);
	const utils = trpc.useUtils();

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

	const { saveState, scheduleSave, flushSave } =
		useSessionAutoSave(saveContent);

	const handleTitleCommit = useCallback(
		(raw: string) => {
			if (!sessionQuery.data) return;
			const title = raw.trim() || null;
			if ((sessionQuery.data.title ?? "") === (title ?? "")) return;
			updateMutation.mutate({ id: sessionQuery.data.id, title });
		},
		[sessionQuery.data, updateMutation],
	);

	const handleDateCommit = useCallback(
		(date: Date) => {
			if (!sessionQuery.data) return;
			if (sessionQuery.data.date.getTime() === date.getTime()) return;
			updateMutation.mutate({ id: sessionQuery.data.id, date });
		},
		[sessionQuery.data, updateMutation],
	);

	const handleUndock = () => {
		if (!activeSessionId) return;
		flushSave();
		const sid = activeSessionId;
		undock();
		void navigate(`/campaign/${campaignId}/sessions/${sid}`);
	};

	if (!activeSessionId) {
		return (
			<aside style={dockShell} aria-label="Docked session">
				<div style={dockHeader}>
					<span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
						No session selected
					</span>
					<button
						type="button"
						aria-label="Close dock"
						style={{ ...buttonGhost, fontSize: "1.1rem", lineHeight: 1 }}
						onClick={undock}
					>
						×
					</button>
				</div>
			</aside>
		);
	}

	if (sessionQuery.isLoading || !sessionQuery.data) {
		return (
			<aside style={dockShell} aria-label="Docked session">
				<div style={dockHeader}>
					<span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
						Loading session…
					</span>
					<button
						type="button"
						aria-label="Close dock"
						style={{ ...buttonGhost, fontSize: "1.1rem", lineHeight: 1 }}
						onClick={undock}
					>
						×
					</button>
				</div>
			</aside>
		);
	}

	const session = sessionQuery.data;
	const isFinal = session.status === "finalized";

	return (
		<aside style={dockShell} aria-label="Docked session">
			<div style={dockHeader}>
				<div style={dockHeaderGroup}>
					<SaveStatus saveState={saveState} />
				</div>
				<div style={dockHeaderGroup}>
					<button
						type="button"
						title="Undock — open in full editor"
						aria-label="Undock session"
						style={iconButtonBase}
						onClick={handleUndock}
					>
						⇤
					</button>
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
					<button
						type="button"
						aria-label="Close dock"
						style={{ ...buttonGhost, fontSize: "1.1rem", lineHeight: 1 }}
						onClick={undock}
					>
						×
					</button>
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
					style={{
						display: "flex",
						flexDirection: "column",
						flex: 1,
						minHeight: 0,
						padding: "var(--space-3)",
					}}
				>
					<SessionMetadata
						sessionNumber={session.sessionNumber}
						title={session.title}
						date={session.date}
						status={isFinal ? "finalized" : "draft"}
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
		</aside>
	);
}
