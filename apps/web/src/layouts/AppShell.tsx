import { useState } from "react";
import { Outlet, useParams } from "react-router";
import { Sidebar } from "./Sidebar.js";

export function AppShell() {
	// TODO: wire up context panel toggle — entity clicks will open this panel (future milestone)
	const [contextPanelOpen, setContextPanelOpen] = useState(false);
	const { id: campaignId } = useParams();

	return (
		<div
			className="app-shell"
			style={{
				display: "flex",
				height: "100vh",
				backgroundColor: "var(--color-bg-primary)",
				color: "var(--color-text-primary)",
				fontFamily: "var(--font-body)",
			}}
		>
			<Sidebar campaignId={campaignId} />

			<main
				className="main-content"
				style={{
					flex: 1,
					overflow: "auto",
					padding: "var(--spacing-xl)",
				}}
			>
				<Outlet />
			</main>

			{contextPanelOpen && (
				<aside
					className="context-panel"
					style={{
						width: "var(--context-panel-width)",
						borderLeft: "1px solid var(--color-border)",
						backgroundColor: "var(--color-bg-secondary)",
						overflow: "auto",
						padding: "var(--spacing-lg)",
					}}
				>
					<button
						type="button"
						onClick={() => setContextPanelOpen(false)}
						style={{
							background: "none",
							border: "none",
							color: "var(--color-text-secondary)",
							cursor: "pointer",
							fontSize: "1.25rem",
						}}
						aria-label="Close context panel"
					>
						&times;
					</button>
					<p style={{ color: "var(--color-text-muted)" }}>
						Context panel — coming soon
					</p>
				</aside>
			)}
		</div>
	);
}
