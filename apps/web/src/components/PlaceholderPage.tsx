interface PlaceholderPageProps {
	title: string;
}

export function PlaceholderPage({ title }: PlaceholderPageProps) {
	return (
		<div style={{ padding: "var(--space-8)" }}>
			<h1
				style={{
					fontFamily: "var(--font-display)",
					fontSize: "1.75rem",
					fontWeight: 700,
					marginBottom: "var(--space-4)",
					color: "var(--text-primary)",
				}}
			>
				{title}
			</h1>
			<p style={{ color: "var(--text-muted)" }}>Coming soon</p>
		</div>
	);
}
