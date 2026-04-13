import { type CSSProperties, useEffect, useMemo } from "react";
import { Outlet, useLocation } from "react-router";
import { ContextPanel } from "../features/agent-chat/components/ContextPanel.js";
import { useMediaQuery } from "../features/agent-chat/hooks/useMediaQuery.js";
import { DockedSessionPanel } from "../features/session-log/components/DockedSessionPanel.js";
import { SessionNotesPanel } from "../features/session-log/components/SessionNotesPanel.js";
import {
	CampaignChromeProvider,
	useCampaignChrome,
} from "./CampaignChromeContext.js";
import { Panel } from "./Panel.js";
import { Rail } from "./Rail.js";

const mainStyle: CSSProperties = {
	flex: 1,
	overflow: "auto",
	minWidth: 0,
};

const placeholderContext: CSSProperties = {
	padding: "var(--space-4)",
	color: "var(--text-muted)",
	fontSize: "0.875rem",
	lineHeight: 1.5,
};

const fullNotesMainWrap: CSSProperties = {
	height: "100%",
	display: "flex",
	flexDirection: "column",
	maxWidth: "900px",
	margin: "0 auto",
	width: "100%",
	minHeight: 0,
};

/** Campaign segment from URL — avoids relying on layout `useParams` / `useMatch` edge cases. */
function campaignIdFromPathname(pathname: string): string | undefined {
	const m = /^\/campaign\/([^/]+)/.exec(pathname);
	return m?.[1];
}

function isAgentChatPathname(pathname: string): boolean {
	return /\/campaign\/[^/]+\/chat/.test(pathname);
}

function AppShellInner() {
	const location = useLocation();
	const campaignId = useMemo(
		() => campaignIdFromPathname(location.pathname),
		[location.pathname],
	);
	const isNarrowForContext = useMediaQuery("(max-width: 1199px)");
	const {
		panelOpen,
		panelTab,
		setPanelOpen,
		setPanelTab,
		openNotes,
		agentChatContextSources,
		setAgentChatContextSources,
		notesLayout,
		resetNotesLayout,
		isDocked,
	} = useCampaignChrome();

	const onAgentChatRoute = isAgentChatPathname(location.pathname);

	useEffect(() => {
		if (!isAgentChatPathname(location.pathname)) {
			setAgentChatContextSources([]);
		}
	}, [location.pathname, setAgentChatContextSources]);

	// Reset full-width notes when the user navigates; effect must track pathname.
	// biome-ignore lint/correctness/useExhaustiveDependencies: run on pathname change only
	useEffect(() => {
		resetNotesLayout();
	}, [location.pathname, resetNotesLayout]);

	useEffect(() => {
		if (!campaignId) resetNotesLayout();
	}, [campaignId, resetNotesLayout]);

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (
				(e.metaKey || e.ctrlKey) &&
				e.shiftKey &&
				e.key.toLowerCase() === "n"
			) {
				e.preventDefault();
				openNotes();
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [openNotes]);

	const reducedMotion =
		typeof window !== "undefined" &&
		typeof window.matchMedia === "function" &&
		window.matchMedia("(prefers-reduced-motion: reduce)").matches;

	const showDock = Boolean(isDocked && campaignId);
	const showPanel = Boolean(
		panelOpen && campaignId && notesLayout !== "full" && !showDock,
	);
	const fullNotesMode = Boolean(campaignId && notesLayout === "full");

	return (
		<div
			className="app-shell"
			style={{
				display: "grid",
				gridTemplateColumns: showDock
					? "var(--rail-width) 1fr var(--dock-width)"
					: showPanel
						? "var(--rail-width) 1fr var(--panel-width)"
						: "var(--rail-width) 1fr",
				height: "100vh",
				backgroundColor: "var(--bg-void)",
				color: "var(--text-primary)",
				fontFamily: "var(--font-body)",
				transition: reducedMotion
					? undefined
					: "grid-template-columns 200ms ease-out",
			}}
		>
			<Rail campaignId={campaignId} />

			<main className="main-content" style={mainStyle}>
				{fullNotesMode && campaignId ? (
					<div style={fullNotesMainWrap}>
						<SessionNotesPanel campaignId={campaignId} layout="full" />
					</div>
				) : (
					<Outlet />
				)}
			</main>

			{showPanel && campaignId ? (
				<Panel
					activeTab={panelTab}
					onTabChange={(t) => setPanelTab(t)}
					onClose={() => setPanelOpen(false)}
					notesContent={
						<SessionNotesPanel campaignId={campaignId} layout="panel" />
					}
					contextContent={
						onAgentChatRoute ? (
							<ContextPanel
								sources={agentChatContextSources}
								onClose={() => setPanelOpen(false)}
								isOverlay={isNarrowForContext}
							/>
						) : (
							<div style={placeholderContext}>
								Open Agent chat to see cited sources and context for this
								campaign.
							</div>
						)
					}
				/>
			) : null}

			{showDock && campaignId ? (
				<DockedSessionPanel campaignId={campaignId} />
			) : null}
		</div>
	);
}

/**
 * Top-level layout: rail + main + optional right panel (session notes / context).
 */
export function AppShell() {
	return (
		<CampaignChromeProvider>
			<AppShellInner />
		</CampaignChromeProvider>
	);
}
