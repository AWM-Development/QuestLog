import { type CSSProperties, useState } from "react";
import { Button } from "../../../components/Button.js";
import { inputField } from "../../../components/styles.js";

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
			<label
				style={{
					display: "flex",
					flexDirection: "column",
					gap: "var(--space-1)",
				}}
			>
				<span style={{ fontSize: "0.6875rem", color: "var(--text-muted)" }}>
					Title
				</span>
				<input
					type="text"
					placeholder="Untitled session"
					value={title}
					onChange={(e) => setTitle(e.target.value)}
					style={inputField}
				/>
			</label>
			<div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
				<label style={{ flex: "1 1 100px" }}>
					<span style={{ fontSize: "0.6875rem", color: "var(--text-muted)" }}>
						Session #
					</span>
					<input
						type="number"
						min={1}
						value={sessionNumber}
						onChange={(e) =>
							setSessionNumber(Number.parseInt(e.target.value, 10) || 1)
						}
						style={{ ...inputField, marginTop: "var(--space-1)" }}
					/>
				</label>
				<label style={{ flex: "1 1 120px" }}>
					<span style={{ fontSize: "0.6875rem", color: "var(--text-muted)" }}>
						Date
					</span>
					<input
						type="date"
						value={dateStr}
						onChange={(e) => setDateStr(e.target.value)}
						style={{ ...inputField, marginTop: "var(--space-1)" }}
					/>
				</label>
			</div>
			<label
				style={{
					display: "flex",
					flexDirection: "column",
					gap: "var(--space-1)",
				}}
			>
				<span style={{ fontSize: "0.6875rem", color: "var(--text-muted)" }}>
					Summary
				</span>
				<input
					type="text"
					placeholder="One-liner for your reference..."
					value={summary}
					onChange={(e) => setSummary(e.target.value)}
					style={inputField}
				/>
			</label>
			<label
				style={{
					display: "flex",
					flexDirection: "column",
					gap: "var(--space-1)",
				}}
			>
				<span style={{ fontSize: "0.6875rem", color: "var(--text-muted)" }}>
					Tags (comma-separated)
				</span>
				<input
					type="text"
					value={tagsRaw}
					onChange={(e) => setTagsRaw(e.target.value)}
					style={inputField}
				/>
			</label>
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
