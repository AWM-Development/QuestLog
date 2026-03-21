import { Outlet, useParams } from "react-router";
import { Rail } from "./Rail.js";

/**
 * Top-level layout shell: rail navigation + main content area.
 *
 * A toggleable context panel (entity detail / session notes) is planned
 * for a future milestone — see MILESTONES.md §11. When implemented,
 * add state + aside here and update the grid template to include the panel column.
 */
export function AppShell() {
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
				}}
			>
				<Outlet />
			</main>
		</div>
	);
}
