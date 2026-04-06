import { NavLink } from "react-router";

/**
 * Rail navigation — replaces the old Sidebar.tsx.
 * 56px icon-only vertical strip with tooltips.
 * See Docs/DESIGN_SYSTEM.md §7.1 for spec.
 */

const navItems = [
	{ to: "chat", label: "Agent chat", icon: "💬" },
	{ to: "sessions", label: "Session logs", icon: "📝" },
	{ to: "prep", label: "Session prep", icon: "📋" },
	{ to: "entities", label: "Entities", icon: "🗺️" },
	{ to: "sources", label: "Sources", icon: "📚" },
];

const bottomItems = [{ to: "settings", label: "Settings", icon: "⚙️" }];

interface RailProps {
	campaignId: string | undefined;
}

const railStyle: React.CSSProperties = {
	width: "var(--rail-width)",
	backgroundColor: "var(--bg-surface)",
	borderRight: "1px solid var(--border-subtle)",
	display: "flex",
	flexDirection: "column",
	alignItems: "center",
	padding: "var(--space-3) 0",
	gap: "2px",
	overflow: "hidden",
};

const logoStyle: React.CSSProperties = {
	width: "34px",
	height: "34px",
	borderRadius: "var(--r-md)",
	backgroundColor: "var(--accent-muted)",
	display: "flex",
	alignItems: "center",
	justifyContent: "center",
	marginBottom: "var(--space-3)",
	textDecoration: "none",
	transition: "background 0.2s",
};

const iconBaseStyle: React.CSSProperties = {
	width: "38px",
	height: "38px",
	borderRadius: "var(--r-md)",
	display: "flex",
	alignItems: "center",
	justifyContent: "center",
	fontSize: "15px",
	textDecoration: "none",
	transition: "all 0.15s",
};

const separatorStyle: React.CSSProperties = {
	width: "20px",
	height: "1px",
	backgroundColor: "var(--border-subtle)",
	margin: "var(--space-2) 0",
};

const mascotStyle: React.CSSProperties = {
	width: "38px",
	height: "38px",
	borderRadius: "var(--r-md)",
	backgroundColor: "var(--bg-elevated)",
	display: "flex",
	alignItems: "center",
	justifyContent: "center",
	fontSize: "18px",
	cursor: "pointer",
	transition: "background 0.2s",
};

export function Rail({ campaignId }: RailProps) {
	return (
		<nav style={railStyle}>
			{/* Logo */}
			<NavLink to="/campaigns" style={logoStyle} title="QuestLog">
				<span
					style={{
						fontFamily: "var(--font-display)",
						fontWeight: 700,
						fontSize: "16px",
						color: "var(--accent)",
					}}
				>
					Q
				</span>
			</NavLink>

			{/* Campaign nav items */}
			{campaignId
				? navItems.map((item) => (
						<NavLink
							key={item.to}
							to={`/campaign/${campaignId}/${item.to}`}
							title={item.label}
							style={({ isActive }) => ({
								...iconBaseStyle,
								color: isActive ? "var(--accent)" : "var(--text-muted)",
								backgroundColor: isActive
									? "var(--accent-muted)"
									: "transparent",
							})}
						>
							{item.icon}
						</NavLink>
					))
				: null}

			{/* Separator */}
			{campaignId && <div style={separatorStyle} />}

			{/* Combat tracker (only with campaign) */}
			{campaignId && (
				<NavLink
					to={`/campaign/${campaignId}/combat`}
					title="Combat tracker"
					style={({ isActive }) => ({
						...iconBaseStyle,
						color: isActive ? "var(--accent)" : "var(--text-muted)",
						backgroundColor: isActive ? "var(--accent-muted)" : "transparent",
					})}
				>
					⚔️
				</NavLink>
			)}

			{/* Bottom section */}
			<div
				style={{
					marginTop: "auto",
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
					gap: "2px",
				}}
			>
				{campaignId
					? bottomItems.map((item) => (
							<NavLink
								key={item.to}
								to={`/campaign/${campaignId}/${item.to}`}
								title={item.label}
								style={({ isActive }) => ({
									...iconBaseStyle,
									color: isActive ? "var(--accent)" : "var(--text-muted)",
									backgroundColor: isActive
										? "var(--accent-muted)"
										: "transparent",
								})}
							>
								{item.icon}
							</NavLink>
						))
					: null}

				{/* Mascot */}
				<div style={mascotStyle} title="Ember — idle">
					<span
						style={{
							display: "inline-block",
							animation: "mascot-idle 4s ease-in-out infinite",
						}}
					>
						🐉
					</span>
				</div>
			</div>
		</nav>
	);
}
