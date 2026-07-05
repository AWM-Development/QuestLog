import { type CSSProperties, useState } from "react";
import { Button } from "../../../../components/buttons/Button.js";
import { FormField, Input } from "../../../../components/inputs/index.js";

interface FinalizeFormProps {
	initialTitle: string | null;
	initialSessionNumber: number;
	initialDate: Date;
	initialSummary: string | null;
	initialTags: string[];
	onConfirm: (data: {
		title: string | null;
		sessionNumber: number;
		date: Date;
		summary: string | null;
		tags: string[];
	}) => void;
	onCancel: () => void;
	isSubmitting: boolean;
	unresolvedCount?: number;
	onReviewInEditor?: () => void;
}

const wrap: CSSProperties = {
	padding: "var(--space-4)",
	borderBottom: "1px solid var(--border-subtle)",
	backgroundColor: "var(--bg-elevated)",
	display: "flex",
	flexDirection: "column",
	gap: "var(--space-3)",
};

export function FinalizeForm({
	initialTitle,
	initialSessionNumber,
	initialDate,
	initialSummary,
	initialTags,
	onConfirm,
	onCancel,
	isSubmitting,
	unresolvedCount = 0,
	onReviewInEditor,
}: FinalizeFormProps) {
	const [title, setTitle] = useState(initialTitle ?? "");
	const [sessionNumber, setSessionNumber] = useState(initialSessionNumber);
	const [dateStr, setDateStr] = useState(
		initialDate.toISOString().slice(0, 10),
	);
	const [summary, setSummary] = useState(initialSummary ?? "");
	const [tagsRaw, setTagsRaw] = useState(initialTags.join(", "));

	const handleSubmit = () => {
		const tags = tagsRaw
			.split(",")
			.map((t) => t.trim())
			.filter(Boolean);
		onConfirm({
			title: title.trim() || null,
			sessionNumber,
			date: new Date(`${dateStr}T12:00:00.000Z`),
			summary: summary.trim() || null,
			tags,
		});
	};

	return (
		<div style={wrap}>
			<span
				style={{
					fontSize: "0.75rem",
					fontWeight: 600,
					color: "var(--text-secondary)",
				}}
			>
				Finalize session
			</span>
			<FormField label="Title" compact>
				<Input
					type="text"
					placeholder="Untitled session"
					value={title}
					onChange={(e) => setTitle(e.target.value)}
				/>
			</FormField>
			<div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
				<div style={{ flex: "1 1 100px" }}>
					<FormField label="Session #" compact>
						<Input
							type="number"
							min={1}
							value={sessionNumber}
							onChange={(e) =>
								setSessionNumber(Number.parseInt(e.target.value, 10) || 1)
							}
							style={{ marginTop: "var(--space-1)" }}
						/>
					</FormField>
				</div>
				<div style={{ flex: "1 1 120px" }}>
					<FormField label="Date" compact>
						<Input
							type="date"
							value={dateStr}
							onChange={(e) => setDateStr(e.target.value)}
							style={{ marginTop: "var(--space-1)" }}
						/>
					</FormField>
				</div>
			</div>
			<FormField label="Summary" compact>
				<Input
					type="text"
					placeholder="One-liner for your reference..."
					value={summary}
					onChange={(e) => setSummary(e.target.value)}
				/>
			</FormField>
			<FormField label="Tags (comma-separated)" compact>
				<Input
					type="text"
					value={tagsRaw}
					onChange={(e) => setTagsRaw(e.target.value)}
				/>
			</FormField>
			{unresolvedCount > 0 && (
				<div
					style={{
						background: "rgba(var(--status-warning-rgb), 0.06)",
						border: "1px solid rgba(var(--status-warning-rgb), 0.2)",
						borderRadius: "var(--r-sm)",
						padding: "var(--space-2-5) var(--space-3)",
						marginBottom: "var(--space-4)",
					}}
				>
					<div
						style={{
							fontSize: "0.75rem",
							color: "var(--status-warning)",
							fontWeight: 500,
							marginBottom: "var(--space-1)",
						}}
					>
						{`⚠ ${unresolvedCount} entity suggestions unresolved`}
					</div>
					<div
						style={{
							fontSize: "0.6875rem",
							color: "var(--text-secondary)",
							marginBottom: "var(--space-2)",
						}}
					>
						{"Some detected names haven't been linked or created."}
					</div>
					<button
						type="button"
						style={{
							fontSize: "0.6875rem",
							color: "var(--status-warning)",
							background: "rgba(var(--status-warning-rgb), 0.08)",
							border: "1px solid rgba(var(--status-warning-rgb), 0.2)",
							borderRadius: "var(--r-sm)",
							padding: "3px var(--space-2-5)",
							cursor: "pointer",
						}}
						onClick={onReviewInEditor}
					>
						Review in editor
					</button>
				</div>
			)}
			<div
				style={{
					display: "flex",
					gap: "var(--space-2)",
					justifyContent: "flex-end",
					flexWrap: "wrap",
				}}
			>
				<Button variant="ghost" onClick={onCancel} disabled={isSubmitting}>
					Cancel
				</Button>
				<Button
					variant="accent"
					size="sm"
					onClick={handleSubmit}
					disabled={isSubmitting}
				>
					Finalize & Save
				</Button>
			</div>
		</div>
	);
}
