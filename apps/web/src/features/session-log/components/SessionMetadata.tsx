import { type CSSProperties, useEffect, useState } from "react";
import {
	inputField,
	sessionMetaDate,
	sessionMetaNumber,
	sessionMetaTitle,
} from "../../../components/styles.js";

interface SessionMetadataProps {
	sessionNumber: number;
	title: string | null;
	date: Date;
	onTitleCommit: (title: string) => void;
	onSessionNumberChange: (n: number) => void;
	onDateChange: (d: Date) => void;
}

const sepStyle: CSSProperties = {
	borderBottom: "1px solid var(--border-subtle)",
	marginTop: "var(--space-3)",
	marginBottom: "var(--space-3)",
};

export function SessionMetadata({
	sessionNumber,
	title,
	date,
	onTitleCommit,
	onSessionNumberChange,
	onDateChange,
}: SessionMetadataProps) {
	const [titleDraft, setTitleDraft] = useState(title ?? "");

	useEffect(() => {
		setTitleDraft(title ?? "");
	}, [title]);

	const dateStr = date.toISOString().slice(0, 10);

	return (
		<div style={{ flexShrink: 0, padding: "0 var(--space-4)" }}>
			<div style={sessionMetaNumber}>Session {sessionNumber}</div>
			<input
				type="text"
				aria-label="Session title"
				placeholder="Untitled session"
				value={titleDraft}
				onChange={(e) => setTitleDraft(e.target.value)}
				onBlur={() => onTitleCommit(titleDraft)}
				style={{
					...sessionMetaTitle,
					marginTop: "var(--space-2)",
					marginBottom: "var(--space-2)",
				}}
			/>
			<div
				style={{
					display: "flex",
					flexDirection: "column",
					gap: "var(--space-2)",
				}}
			>
				<label
					style={{
						display: "flex",
						flexDirection: "column",
						gap: "var(--space-1)",
					}}
				>
					<span style={sessionMetaDate}>Date</span>
					<input
						type="date"
						value={dateStr}
						onChange={(e) => {
							const v = e.target.value;
							if (v) onDateChange(new Date(`${v}T12:00:00.000Z`));
						}}
						style={{ ...inputField, fontSize: "0.75rem", padding: "6px 10px" }}
					/>
				</label>
				<label
					style={{
						display: "flex",
						flexDirection: "column",
						gap: "var(--space-1)",
					}}
				>
					<span style={sessionMetaDate}>Session #</span>
					<input
						type="number"
						min={1}
						value={sessionNumber}
						onChange={(e) => {
							const n = Number.parseInt(e.target.value, 10);
							if (!Number.isNaN(n) && n > 0) onSessionNumberChange(n);
						}}
						style={{ ...inputField, fontSize: "0.75rem", padding: "6px 10px" }}
					/>
				</label>
			</div>
			<div style={sepStyle} />
		</div>
	);
}
