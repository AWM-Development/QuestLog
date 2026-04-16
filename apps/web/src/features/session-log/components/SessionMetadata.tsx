import { type CSSProperties, useEffect, useRef, useState } from "react";
import {
	sessionOverline,
	sessionTitleInput,
} from "../../../components/styles.js";

export type SessionStatus = "draft" | "finalized";

interface SessionMetadataProps {
	sessionNumber: number;
	title: string | null;
	date: Date;
	status: SessionStatus;
	onTitleCommit: (title: string) => void;
	onDateCommit: (d: Date) => void;
}

const separatorStyle: CSSProperties = {
	borderBottom: "1px solid var(--border-subtle)",
	marginTop: "var(--space-2)",
	marginBottom: "var(--space-4)",
};

const dateButtonStyle: CSSProperties = {
	background: "transparent",
	border: "none",
	padding: 0,
	margin: 0,
	color: "var(--text-muted)",
	font: "inherit",
	cursor: "pointer",
	textTransform: "inherit",
	letterSpacing: "inherit",
};

const hiddenDateInputStyle: CSSProperties = {
	position: "absolute",
	inset: 0,
	opacity: 0,
	pointerEvents: "none",
	width: "100%",
	height: "100%",
};

function formatLocalYMD(d: Date): string {
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, "0");
	const day = String(d.getDate()).padStart(2, "0");
	return `${y}-${m}-${day}`;
}

function formatOverlineDate(d: Date): string {
	return d
		.toLocaleDateString("en-US", {
			month: "short",
			day: "numeric",
			year: "numeric",
		})
		.toUpperCase();
}

export function SessionMetadata({
	sessionNumber,
	title,
	date,
	status,
	onTitleCommit,
	onDateCommit,
}: SessionMetadataProps) {
	const [titleDraft, setTitleDraft] = useState(title ?? "");
	const dateInputRef = useRef<HTMLInputElement | null>(null);

	useEffect(() => {
		setTitleDraft(title ?? "");
	}, [title]);

	const commitTitle = () => {
		onTitleCommit(titleDraft);
	};

	const openDatePicker = () => {
		const input = dateInputRef.current;
		if (!input) return;
		// showPicker() is the modern affordance; fall back to focus+click.
		if (typeof input.showPicker === "function") {
			try {
				input.showPicker();
				return;
			} catch {
				/* fall through */
			}
		}
		input.focus();
		input.click();
	};

	const handleDateChange = (raw: string) => {
		if (!raw) return;
		const [y, m, d] = raw.split("-").map(Number);
		if (y === undefined || m === undefined || d === undefined) return;
		onDateCommit(new Date(y, m - 1, d));
	};

	const finalized = status === "finalized";

	return (
		<div>
			<div data-testid="session-overline" style={sessionOverline}>
				{finalized ? (
					<span style={{ color: "var(--status-success)" }}>✓</span>
				) : null}
				<span>SESSION {sessionNumber}</span>
				<span aria-hidden="true">·</span>
				<span style={{ position: "relative", display: "inline-block" }}>
					<button
						type="button"
						aria-label="Edit session date"
						onClick={openDatePicker}
						style={dateButtonStyle}
					>
						{formatOverlineDate(date)}
					</button>
					<input
						ref={dateInputRef}
						type="date"
						aria-label="Session date"
						tabIndex={-1}
						defaultValue={formatLocalYMD(date)}
						onChange={(e) => handleDateChange(e.target.value)}
						style={hiddenDateInputStyle}
					/>
				</span>
				{!finalized ? (
					<>
						<span aria-hidden="true">·</span>
						<span>DRAFT</span>
					</>
				) : null}
			</div>
			<input
				type="text"
				aria-label="Session title"
				placeholder="Untitled session"
				value={titleDraft}
				onChange={(e) => setTitleDraft(e.target.value)}
				onBlur={commitTitle}
				style={sessionTitleInput}
			/>
			<div style={separatorStyle} />
		</div>
	);
}
