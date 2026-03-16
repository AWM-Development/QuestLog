interface PlaceholderPageProps {
	title: string;
}

export function PlaceholderPage({ title }: PlaceholderPageProps) {
	return (
		<div>
			<h1
				style={{
					fontFamily: "var(--font-heading)",
					fontSize: "1.75rem",
					fontWeight: 700,
					marginBottom: "var(--spacing-md)",
					color: "var(--color-text-primary)",
				}}
			>
				{title}
			</h1>
			<p style={{ color: "var(--color-text-muted)" }}>Coming soon</p>
		</div>
	);
}
