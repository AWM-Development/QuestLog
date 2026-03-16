import { NavLink } from "react-router";

const campaignNavItems = [
	{ to: "chat", label: "Agent Chat" },
	{ to: "sessions", label: "Session Logs" },
	{ to: "prep", label: "Session Prep" },
	{ to: "entities", label: "Entities" },
	{ to: "sources", label: "Sources" },
	{ to: "settings", label: "Settings" },
];

interface SidebarProps {
	campaignId: string | undefined;
}

export function Sidebar({ campaignId }: SidebarProps) {
	return (
		<nav
			className="sidebar"
			style={{
				width: "var(--sidebar-width)",
				backgroundColor: "var(--color-bg-secondary)",
				borderRight: "1px solid var(--color-border)",
				display: "flex",
				flexDirection: "column",
				overflow: "hidden",
			}}
		>
			<div
				style={{
					padding: "var(--spacing-lg)",
					borderBottom: "1px solid var(--color-border)",
				}}
			>
				<NavLink
					to="/campaigns"
					style={{
						fontFamily: "var(--font-heading)",
						fontSize: "1.25rem",
						fontWeight: 700,
						color: "var(--color-accent)",
						textDecoration: "none",
					}}
				>
					QuestLog
				</NavLink>
			</div>

			<div
				style={{
					flex: 1,
					overflow: "auto",
					padding: "var(--spacing-md)",
				}}
			>
				<NavLink
					to="/campaigns"
					style={({ isActive }) => ({
						display: "block",
						padding: "var(--spacing-sm) var(--spacing-md)",
						borderRadius: "var(--radius-sm)",
						color: isActive
							? "var(--color-accent)"
							: "var(--color-text-secondary)",
						textDecoration: "none",
						backgroundColor: isActive
							? "var(--color-accent-muted)"
							: "transparent",
						marginBottom: "var(--spacing-sm)",
						fontSize: "0.875rem",
					})}
				>
					All Campaigns
				</NavLink>

				{campaignId && (
					<div
						style={{
							borderTop: "1px solid var(--color-border)",
							paddingTop: "var(--spacing-md)",
							marginTop: "var(--spacing-sm)",
						}}
					>
						<p
							style={{
								fontSize: "0.75rem",
								textTransform: "uppercase",
								letterSpacing: "0.05em",
								color: "var(--color-text-muted)",
								marginBottom: "var(--spacing-sm)",
								padding: "0 var(--spacing-md)",
							}}
						>
							Campaign
						</p>
						{campaignNavItems.map((item) => (
							<NavLink
								key={item.to}
								to={`/campaign/${campaignId}/${item.to}`}
								style={({ isActive }) => ({
									display: "block",
									padding: "var(--spacing-sm) var(--spacing-md)",
									borderRadius: "var(--radius-sm)",
									color: isActive
										? "var(--color-accent)"
										: "var(--color-text-secondary)",
									textDecoration: "none",
									backgroundColor: isActive
										? "var(--color-accent-muted)"
										: "transparent",
									marginBottom: "2px",
									fontSize: "0.875rem",
								})}
							>
								{item.label}
							</NavLink>
						))}
					</div>
				)}
			</div>

			{/* Mascot placeholder */}
			<div
				className="mascot-placeholder"
				style={{
					padding: "var(--spacing-lg)",
					borderTop: "1px solid var(--color-border)",
					textAlign: "center",
					color: "var(--color-text-muted)",
					fontSize: "0.75rem",
				}}
			>
				<div style={{ fontSize: "2rem", marginBottom: "var(--spacing-xs)" }}>
					🐉
				</div>
				<span>Mascot</span>
			</div>
		</nav>
	);
}
