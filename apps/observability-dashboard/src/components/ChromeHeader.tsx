import { NavLink } from "react-router";

/**
 * Top chrome shared by Trends (this ticket) and Log (T-058) — built now
 * since Trends ships first, per T-057's Scope. Top-nav, not the main app's
 * rail+panel grid: this is a standalone tool, not a screen inside the RPG
 * app (Docs/mockups/observability-dashboard/NOTES.md's "Design-system
 * reuse" section).
 */
export function ChromeHeader() {
	return (
		<header className="chrome-header">
			<div className="chrome-title">
				QuestLog Pipeline Observatory
				<span className="sub">Trends · Log — one page each morning</span>
			</div>
			<nav className="chrome-nav">
				<NavLink
					to="/"
					end
					className={({ isActive }) => (isActive ? "active" : "")}
				>
					Trends
				</NavLink>
				<NavLink
					to="/log"
					className={({ isActive }) => (isActive ? "active" : "")}
				>
					Log
				</NavLink>
			</nav>
		</header>
	);
}
