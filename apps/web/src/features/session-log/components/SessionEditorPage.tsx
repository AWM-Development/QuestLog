import { type CSSProperties, useCallback, useRef, useState } from "react";
import { Link, useParams } from "react-router";
import {
	buttonAccent,
	buttonGhost,
	buttonSecondary,
} from "../../../components/styles.js";
import { trpc } from "../../../lib/trpc.js";
import { useSessionAutoSave } from "../hooks/useSessionAutoSave.js";
import { FinalizeForm } from "./FinalizeForm.js";
import { SaveStatus } from "./SaveStatus.js";
import { SessionEditor } from "./SessionEditor.js";
import { SessionMetadata } from "./SessionMetadata.js";

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
	...buttonGhost,
	padding: "4px 10px",
	fontSize: "0.75rem",
	textDecoration: "none",
	display: "inline-flex",
	alignItems: "center",
	gap: "0.35em",
};

const scrollArea: CSSProperties = {
	flex: 1,
	minHeight: 0,
	overflow: "auto",
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
	const [finalizeOpen, setFinalizeOpen] = useState(false);

	const sessionQuery = trpc.session.getById.useQuery(
		{ id: sessionId ?? "" },
		{ enabled: !!sessionId },
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

	const { saveState, scheduleSave } = useSessionAutoSave(saveContent);

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
				</div>
				<div style={headerGroup}>
					<SaveStatus saveState={saveState} />
					{isFinal ? (
						<button
							type="button"
							onClick={() => setFinalizeOpen(true)}
							style={{
								...buttonSecondary,
								padding: "4px 12px",
								fontSize: "0.75rem",
							}}
						>
							Update
						</button>
					) : (
						<button
							type="button"
							onClick={() => setFinalizeOpen(true)}
							style={{
								...buttonAccent,
								padding: "4px 12px",
								fontSize: "0.75rem",
							}}
						>
							Save Session
						</button>
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
							key={session.id}
							sessionId={session.id}
							content={session.content}
							placeholder="Start writing your session notes here. Jot quick lines as things happen — entity links will be detected automatically.

Type / for formatting options."
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
