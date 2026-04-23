import { type CSSProperties, type ReactNode, useEffect } from "react";
import { Button } from "../components/buttons/Button.js";
import { panelHeaderBase } from "../components/styles.js";
import type { PanelTab } from "./CampaignChromeContext.js";

const panelShell: CSSProperties = {
	backgroundColor: "var(--bg-surface)",
	borderLeft: "1px solid var(--border-subtle)",
	display: "flex",
	flexDirection: "column",
	height: "100vh",
	overflow: "hidden",
	minWidth: 0,
};

const tabBarStyle: CSSProperties = {
	display: "flex",
	borderBottom: "1px solid var(--border-subtle)",
	padding: "0 var(--space-3)",
	flexShrink: 0,
};

const activeTabStyle: CSSProperties = {
	color: "var(--accent)",
	borderBottom: "2px solid var(--accent)",
	padding: "var(--space-3) var(--space-4)",
	fontSize: "0.8125rem",
	fontWeight: 500,
	background: "transparent",
	border: "none",
	borderLeft: "none",
	borderRight: "none",
	borderTop: "none",
	cursor: "pointer",
};

const inactiveTabStyle: CSSProperties = {
	...activeTabStyle,
	color: "var(--text-muted)",
	borderBottom: "2px solid transparent",
};

const bodyStyle: CSSProperties = {
	flex: 1,
	display: "flex",
	flexDirection: "column",
	minHeight: 0,
	overflow: "hidden",
};

interface PanelProps {
	activeTab: PanelTab;
	onTabChange: (tab: PanelTab) => void;
	onClose: () => void;
	notesContent: ReactNode;
	contextContent: ReactNode;
}

export function Panel({
	activeTab,
	onTabChange,
	onClose,
	notesContent,
	contextContent,
}: PanelProps) {
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [onClose]);

	return (
		<aside style={panelShell} aria-label="Side panel">
			<div
				style={{
					...panelHeaderBase,
					flexShrink: 0,
					display: "flex",
					alignItems: "center",
					justifyContent: "space-between",
					gap: "var(--space-2)",
				}}
			>
				<div style={tabBarStyle}>
					<button
						type="button"
						style={activeTab === "context" ? activeTabStyle : inactiveTabStyle}
						onClick={() => onTabChange("context")}
					>
						Context
					</button>
					<button
						type="button"
						style={activeTab === "notes" ? activeTabStyle : inactiveTabStyle}
						onClick={() => onTabChange("notes")}
					>
						Session notes
					</button>
				</div>
				<Button
					variant="ghost"
					onClick={onClose}
					aria-label="Close panel"
					style={{ fontSize: "1.1rem", lineHeight: 1 }}
				>
					×
				</Button>
			</div>
			<div style={bodyStyle}>
				{activeTab === "notes" ? notesContent : contextContent}
			</div>
		</aside>
	);
}
