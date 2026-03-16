import { useRef, useState } from "react";

interface FileDropZoneProps {
	onFilesSelected: (files: File[]) => void;
}

const ACCEPTED_TYPES = new Set([
	"application/pdf",
	"text/markdown",
	"text/x-markdown",
	"text/plain",
	"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);
const MAX_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB

export function FileDropZone({ onFilesSelected }: FileDropZoneProps) {
	const [isDragging, setIsDragging] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);

	function filterFiles(files: FileList | File[]): File[] {
		return Array.from(files).filter((file) => {
			if (!ACCEPTED_TYPES.has(file.type)) {
				console.warn(`Unsupported file type: ${file.type} (${file.name})`);
				return false;
			}
			if (file.size > MAX_SIZE_BYTES) {
				console.warn(`File too large: ${file.name} (${file.size} bytes)`);
				return false;
			}
			return true;
		});
	}

	function handleDragOver(e: React.DragEvent) {
		e.preventDefault();
		setIsDragging(true);
	}

	function handleDragLeave(e: React.DragEvent) {
		// Only set to false when leaving the zone entirely (not a child element)
		if (!e.currentTarget.contains(e.relatedTarget as Node)) {
			setIsDragging(false);
		}
	}

	function handleDrop(e: React.DragEvent) {
		e.preventDefault();
		setIsDragging(false);
		const valid = filterFiles(e.dataTransfer.files);
		if (valid.length > 0) onFilesSelected(valid);
	}

	function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
		const files = e.target.files;
		if (!files) return;
		const valid = filterFiles(files);
		if (valid.length > 0) onFilesSelected(valid);
		// Reset input so the same file can be re-selected
		e.target.value = "";
	}

	return (
		<div>
			<button
				type="button"
				role="button"
				data-dragging={isDragging ? "true" : "false"}
				onClick={() => inputRef.current?.click()}
				onDragOver={handleDragOver}
				onDragLeave={handleDragLeave}
				onDrop={handleDrop}
				style={{
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
					justifyContent: "center",
					gap: "var(--space-2)",
					height: 130,
					width: "100%",
					border: `1px dashed ${isDragging ? "var(--accent)" : "var(--border)"}`,
					borderRadius: "var(--r-md)",
					backgroundColor: isDragging ? "var(--accent-muted)" : "transparent",
					cursor: "pointer",
					transition: "border-color 0.15s, background-color 0.15s",
					padding: 0,
				}}
			>
				<span
					style={{
						fontFamily: "var(--font-display)",
						fontSize: "1rem",
						color: "var(--text-primary)",
					}}
				>
					Drop files here
				</span>
				<span
					style={{
						fontSize: "0.875rem",
						color: "var(--text-secondary)",
					}}
				>
					or click to browse
				</span>
				<span
					style={{
						fontSize: "0.75rem",
						color: "var(--text-muted)",
					}}
				>
					PDF · MD · TXT · DOCX — up to 50 MB
				</span>
			</button>

			<input
				ref={inputRef}
				type="file"
				multiple
				accept=".pdf,.md,.txt,.docx"
				onChange={handleInputChange}
				style={{ display: "none" }}
				aria-hidden="true"
				tabIndex={-1}
			/>
		</div>
	);
}
