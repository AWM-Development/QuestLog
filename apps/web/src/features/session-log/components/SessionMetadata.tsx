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
	onSessionNumberCommit: (n: number) => void;
	onDateCommit: (d: Date) => void;
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
	onSessionNumberCommit,
	onDateCommit,
}: SessionMetadataProps) {
	const [titleDraft, setTitleDraft] = useState(title ?? "");
	const [numberDraft, setNumberDraft] = useState(String(sessionNumber));
	const [dateDraft, setDateDraft] = useState(() =>
		date.toISOString().slice(0, 10),
	);

	useEffect(() => {
		setTitleDraft(title ?? "");
	}, [title]);

	useEffect(() => {
		setNumberDraft(String(sessionNumber));
	}, [sessionNumber]);

	const dateKey = date.toISOString().slice(0, 10);
	useEffect(() => {
		setDateDraft(dateKey);
	}, [dateKey]);

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
						value={dateDraft}
						onChange={(e) => setDateDraft(e.target.value)}
						onBlur={() => {
							if (!dateDraft) {
								setDateDraft(date.toISOString().slice(0, 10));
								return;
							}
							onDateCommit(new Date(`${dateDraft}T12:00:00.000Z`));
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
						value={numberDraft}
						onChange={(e) => setNumberDraft(e.target.value)}
						onBlur={() => {
							const n = Number.parseInt(numberDraft, 10);
							if (!Number.isNaN(n) && n > 0) {
								onSessionNumberCommit(n);
							} else {
								setNumberDraft(String(sessionNumber));
							}
						}}
						style={{ ...inputField, fontSize: "0.75rem", padding: "6px 10px" }}
					/>
				</label>
			</div>
			<div style={sepStyle} />
		</div>
	);
}
