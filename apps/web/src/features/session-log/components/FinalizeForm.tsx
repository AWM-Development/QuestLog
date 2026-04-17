import { type CSSProperties, useState } from "react";
import { Button } from "../../../components/Button.js";
import { FormField, Input } from "../../../components/primitives/index.js";

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
