import { type CSSProperties, useEffect } from "react";
import { Outlet, useParams } from "react-router";
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

function AppShellInner() {
	const { id: campaignId } = useParams();
	const {
		panelOpen,
		panelTab,
		setPanelOpen,
		setPanelTab,
		openNotes,
		contextPanelContent,
	} = useCampaignChrome();

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

	const showPanel = Boolean(panelOpen && campaignId);

	return (
		<div
			className="app-shell"
			style={{
				display: "grid",
				gridTemplateColumns: showPanel
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
				<Outlet />
			</main>

			{showPanel && campaignId ? (
				<Panel
					activeTab={panelTab}
					onTabChange={(t) => setPanelTab(t)}
					onClose={() => setPanelOpen(false)}
					notesContent={<SessionNotesPanel campaignId={campaignId} />}
					contextContent={
						contextPanelContent ?? (
							<div style={placeholderContext}>
								Open Agent chat to see cited sources and context for this
								campaign.
							</div>
						)
					}
				/>
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
