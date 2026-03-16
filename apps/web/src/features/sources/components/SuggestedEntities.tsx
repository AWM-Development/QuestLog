/**
 * Stub for the Suggested Entities section.
 * Real implementation deferred to Milestone 5 (Entity Graph).
 */
export function SuggestedEntities() {
	return (
		<div>
			<h2
				style={{
					fontFamily: "var(--font-display)",
					fontSize: "1rem",
					fontWeight: 600,
					color: "var(--text-secondary)",
					marginBottom: "var(--space-2)",
				}}
			>
				Suggested entities
			</h2>
			<p style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>
				Auto-detected from your imports — click + to add to your campaign
			</p>
			<p
				style={{
					fontSize: "0.8125rem",
					color: "var(--text-muted)",
					fontStyle: "italic",
					marginTop: "var(--space-3)",
				}}
			>
				Entity suggestions will appear here after processing completes.
			</p>
		</div>
	);
}
