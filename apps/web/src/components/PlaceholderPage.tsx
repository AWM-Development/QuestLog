import { PageContainer, PageHeader } from "./PageScaffold.js";

interface PlaceholderPageProps {
	title: string;
}

export function PlaceholderPage({ title }: PlaceholderPageProps) {
	return (
		<PageContainer style={{ padding: "var(--space-8)" }}>
			<PageHeader title={title} />
			<p style={{ color: "var(--text-muted)" }}>Coming soon</p>
		</PageContainer>
	);
}
