import { type CSSProperties, useCallback, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { Button } from "../../../components/buttons/Button.js";
import { IconButton } from "../../../components/buttons/IconButton.js";
import { useCampaignChrome } from "../../../layouts/CampaignChromeContext.js";
import { trpc } from "../../../lib/trpc.js";
import { DetectedEntitiesPanel } from "../components/editor/DetectedEntitiesPanel.js";
import type { SessionEditorHandle } from "../components/editor/SessionEditor.js";
import {
	FinalizeForm,
	SaveStatus,
	SessionEditor,
	SessionMetadata,
} from "../components/editor/index.js";
import { useHoveredEntity } from "../hooks/useHoveredEntity.js";
import { useSessionAutoSave } from "../hooks/useSessionAutoSave.js";
import type { EntitySpan } from "../types.js";

const pageRoot: CSSProperties = {
	display: "flex",
	flexDirection: "column",
	height: "100%",
	minHeight: 0,
	backgroundColor: "var(--bg-void)",
};

const headerBar: CSSProperties = {
	position: "sticky",
	top: 0,
	zIndex: 2,
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	gap: "var(--space-3)",
	padding: "var(--space-3) var(--space-5)",
	borderBottom: "1px solid var(--border-subtle)",
	backgroundColor: "var(--bg-surface)",
	flexShrink: 0,
};

const headerGroup: CSSProperties = {
	display: "flex",
	alignItems: "center",
	gap: "var(--space-3)",
	minWidth: 0,
};

const backLinkStyle: CSSProperties = {
	borderRadius: "var(--r-sm)",
	border: "none",
	backgroundColor: "transparent",
	color: "var(--text-muted)",
	fontFamily: "var(--font-body)",
	cursor: "pointer",
	transition: "all 0.15s",
	padding: "var(--space-1) 10px",
	fontSize: "0.75rem",
	textDecoration: "none",
	display: "inline-flex",
	alignItems: "center",
	gap: "0.35em",
};

const breadcrumbSep: CSSProperties = {
	color: "var(--text-dim)",
	fontSize: "0.75rem",
	userSelect: "none",
};

const sessionContextStyle: CSSProperties = {
	fontFamily: "var(--font-mono)",
	fontSize: "0.625rem",
	letterSpacing: "0.08em",
	textTransform: "uppercase",
	color: "var(--text-muted)",
};

const bodyRow: CSSProperties = {
	flex: 1,
	minHeight: 0,
	display: "flex",
	flexDirection: "row",
};

const scrollArea: CSSProperties = {
	flex: 1,
	minHeight: 0,
	overflow: "auto",
};

const entitiesDock: CSSProperties = {
	width: "320px",
	flexShrink: 0,
	borderLeft: "1px solid var(--border-subtle)",
	backgroundColor: "var(--bg-surface)",
	overflow: "auto",
	padding: "var(--space-3)",
};

const contentColumn: CSSProperties = {
	width: "100%",
	maxWidth: "var(--sessionlog-max-width)",
	margin: "0 auto",
	padding: "var(--space-8) var(--space-5)",
	display: "flex",
	flexDirection: "column",
	minHeight: "100%",
	boxSizing: "border-box",
};

export function SessionEditorPage() {
	const { id: campaignId, sessionId } = useParams<{
		id: string;
		sessionId: string;
	}>();
	const navigate = useNavigate();
	const { dockSession } = useCampaignChrome();
	const [finalizeOpen, setFinalizeOpen] = useState(false);
	const [unresolvedCount, setUnresolvedCount] = useState(0);
	const [detectedSpans, setDetectedSpans] = useState<EntitySpan[]>([]);
	const editorRef = useRef<SessionEditorHandle>(null);
	const { hoveredSpan, setHoveredSpan } = useHoveredEntity();

	const sessionQuery = trpc.session.getById.useQuery(
		{ id: sessionId ?? "" },
		{ enabled: !!sessionId },
	);

	const campaignQuery = trpc.campaign.getById.useQuery(
		{ id: campaignId ?? "" },
		{ enabled: !!campaignId },
	);

	const entityCountQuery = trpc.entity.countByCampaign.useQuery(
		{ campaignId: campaignId ?? "" },
		{ enabled: !!campaignId },
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

	// Ref-based mutateAsync so the autosave closure is stable across renders.
	const updateMutateAsyncRef = useRef(updateMutation.mutateAsync);
	updateMutateAsyncRef.current = updateMutation.mutateAsync;

	const saveContent = useCallback(
		async (contentJson: string) => {
			if (!sessionId) return;
			await updateMutateAsyncRef.current({
				id: sessionId,
				content: contentJson,
			});
		},
		[sessionId],
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

	if (!campaignId || !sessionId) return null;

	if (sessionQuery.isLoading || !sessionQuery.data) {
		return (
			<div style={{ padding: "var(--space-6)", color: "var(--text-muted)" }}>
				Loading session…
			</div>
		);
	}

	const session = sessionQuery.data;
	const isFinal = session.status === "finalized";

	return (
		<div style={pageRoot}>
			<header style={headerBar}>
				<div style={headerGroup}>
					<Link to={`/campaign/${campaignId}/sessions`} style={backLinkStyle}>
						← Sessions
					</Link>
					{campaignQuery.data?.name && (
						<>
							<span style={breadcrumbSep}>›</span>
							<span data-testid="header-campaign-crumb" style={backLinkStyle}>
								{campaignQuery.data.name}
							</span>
						</>
					)}
					<span style={breadcrumbSep}>›</span>
					<span
						data-testid="header-session-context"
						style={sessionContextStyle}
					>
						SESSION {session.sessionNumber}
					</span>
				</div>
				<div style={headerGroup}>
					<SaveStatus saveState={saveState} />
					<IconButton
						label="Dock"
						size={24}
						title="Dock — keep editing while you navigate"
						onClick={() => {
							if (!sessionId || !campaignId) return;
							flushSave();
							dockSession(sessionId);
							void navigate(`/campaign/${campaignId}/sessions`);
						}}
					>
						⇥
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
				</div>
			</header>

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

			<div style={bodyRow}>
				<div style={scrollArea}>
					<div style={contentColumn}>
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
								placeholder="Start writing your session notes here. Jot quick lines as things happen — entity links will be detected automatically.

Type / for formatting options."
								onContentChange={(json) => {
									scheduleSave(json);
								}}
								onUnresolvedCountChange={setUnresolvedCount}
								onDetectedSpansChange={setDetectedSpans}
								onHoveredSpanChange={setHoveredSpan}
								initialDismissedEntityTexts={session.dismissedEntityTexts ?? []}
								onDismissedEntityTextsChange={(texts) => {
									updateMutation.mutate({
										id: session.id,
										dismissedEntityTexts: texts,
									});
								}}
							/>
						</div>
					</div>
				</div>
				<aside style={entitiesDock}>
					<DetectedEntitiesPanel
						detectedSpans={detectedSpans}
						onScrollToSpan={(span) => editorRef.current?.scrollToSpan(span)}
						onActivateActionBar={(span) =>
							editorRef.current?.activateActionBar(span)
						}
						hoveredSpan={hoveredSpan}
						campaignEntityCount={entityCountQuery.data ?? undefined}
						onSelectCandidate={(candidate) => {
							if (hoveredSpan) {
								editorRef.current?.linkSpan(
									hoveredSpan,
									candidate.id,
									candidate.name,
								);
							}
							setHoveredSpan(null);
						}}
						onCreateNew={() => {
							if (hoveredSpan) {
								editorRef.current?.activateActionBar(hoveredSpan);
							}
							setHoveredSpan(null);
						}}
						onSkipHover={() => setHoveredSpan(null)}
					/>
				</aside>
			</div>
		</div>
	);
}
