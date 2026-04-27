import {
	type CSSProperties,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";
import { useNavigate } from "react-router";
import { Button } from "../../../../components/buttons/Button.js";
import { IconButton } from "../../../../components/buttons/IconButton.js";
import { useCampaignChrome } from "../../../../layouts/CampaignChromeContext.js";
import { trpc } from "../../../../lib/trpc.js";
import { useSessionAutoSave } from "../../hooks/useSessionAutoSave.js";
import type { EntitySpan } from "../../types.js";
import { DetectedEntitiesPanel } from "../editor/DetectedEntitiesPanel.js";
import type { SessionEditorHandle } from "../editor/SessionEditor.js";
import {
	FinalizeForm,
	SaveStatus,
	SessionEditor,
	SessionMetadata,
} from "../editor/index.js";

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
	const [unresolvedCount, setUnresolvedCount] = useState(0);
	const [detectedSpans, setDetectedSpans] = useState<EntitySpan[]>([]);
	const editorRef = useRef<SessionEditorHandle>(null);

	// biome-ignore lint/correctness/useExhaustiveDependencies: activeSessionId is the trigger; setUnresolvedCount is a stable setter
	useEffect(() => {
		setUnresolvedCount(0);
	}, [activeSessionId]);

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
					<Button
						variant="ghost"
						aria-label="Close dock"
						style={{ fontSize: "1.1rem", lineHeight: 1 }}
						onClick={undock}
					>
						×
					</Button>
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
					<Button
						variant="ghost"
						aria-label="Close dock"
						style={{ fontSize: "1.1rem", lineHeight: 1 }}
						onClick={undock}
					>
						×
					</Button>
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
					<IconButton
						label="Undock session"
						size={24}
						title="Undock — open in full editor"
						onClick={handleUndock}
					>
						⇤
					</IconButton>
					{isFinal ? (
						<Button
							variant="secondary"
							size="sm"
							onClick={() => setFinalizeOpen(true)}
						>
							Update
						</Button>
					) : (
						<Button
							variant="accent"
							size="sm"
							onClick={() => setFinalizeOpen(true)}
						>
							Save Session
						</Button>
					)}
					<Button
						variant="ghost"
						aria-label="Close dock"
						style={{ fontSize: "1.1rem", lineHeight: 1 }}
						onClick={undock}
					>
						×
					</Button>
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
							unresolvedCount={unresolvedCount}
							onReviewInEditor={() => setFinalizeOpen(false)}
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
							ref={editorRef}
							key={session.id}
							sessionId={session.id}
							campaignId={campaignId}
							content={session.content}
							placeholder="Start writing your session notes here. Type / for formatting options."
							onContentChange={(json) => {
								scheduleSave(json);
							}}
							onUnresolvedCountChange={setUnresolvedCount}
							onDetectedSpansChange={setDetectedSpans}
							initialDismissedEntityTexts={session.dismissedEntityTexts ?? []}
							onDismissedEntityTextsChange={(texts) => {
								updateMutation.mutate({
									id: session.id,
									dismissedEntityTexts: texts,
								});
							}}
						/>
					</div>
					<DetectedEntitiesPanel
						detectedSpans={detectedSpans}
						onScrollToSpan={(span) => editorRef.current?.scrollToSpan(span)}
						onActivateActionBar={(span) =>
							editorRef.current?.activateActionBar(span)
						}
					/>
				</div>
			</div>
		</aside>
	);
}
