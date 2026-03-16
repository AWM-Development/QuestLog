import { useState } from "react";
import { Outlet, useParams } from "react-router";
import { Rail } from "./Rail.js";

export function AppShell() {
	// TODO: wire up context panel toggle — entity clicks will open this panel (future milestone)
	const [contextPanelOpen, setContextPanelOpen] = useState(false);
	const { id: campaignId } = useParams();

	return (
		<div
			className="app-shell"
			style={{
				display: "grid",
				gridTemplateColumns: "var(--rail-width) 1fr",
				height: "100vh",
				backgroundColor: "var(--bg-void)",
				color: "var(--text-primary)",
				fontFamily: "var(--font-body)",
			}}
		>
			<Rail campaignId={campaignId} />

			<main
				className="main-content"
				style={{
					flex: 1,
					overflow: "auto",
					padding: "var(--space-8)",
				}}
			>
				<Outlet />
			</main>

			{contextPanelOpen && (
				<aside
					className="context-panel"
					style={{
						width: "var(--panel-width)",
						borderLeft: "1px solid var(--border)",
						backgroundColor: "var(--bg-surface)",
						overflow: "auto",
						padding: "var(--space-6)",
					}}
				>
					<button
						type="button"
						onClick={() => setContextPanelOpen(false)}
						style={{
							background: "none",
							border: "none",
							color: "var(--text-secondary)",
							cursor: "pointer",
							fontSize: "1.25rem",
						}}
						aria-label="Close context panel"
					>
						&times;
					</button>
					<p style={{ color: "var(--text-muted)" }}>
						Context panel — coming soon
					</p>
				</aside>
			)}
		</div>
	);
}
