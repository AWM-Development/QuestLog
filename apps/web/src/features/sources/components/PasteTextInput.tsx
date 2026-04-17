import { Button } from "@/components/Button.js";
import { Input } from "@/components/Input.js";
import { inputField } from "@/components/styles.js";
import { trpc } from "@/lib/trpc.js";
import { useEffect, useRef, useState } from "react";

interface PasteTextInputProps {
	campaignId: string;
	/** Pre-fill the title when opened from an ErrorState "Paste text instead" action */
	initialTitle?: string;
	onClose?: () => void;
}

export function PasteTextInput({
	campaignId,
	initialTitle,
	onClose,
}: PasteTextInputProps) {
	const [isExpanded, setIsExpanded] = useState(false);
	const [title, setTitle] = useState(initialTitle ?? "");
	const [content, setContent] = useState("");
	const titleRef = useRef<HTMLInputElement>(null);
	const utils = trpc.useUtils();

	// Auto-expand and pre-fill when initialTitle is provided
	useEffect(() => {
		if (initialTitle) {
			setTitle(initialTitle);
			setIsExpanded(true);
		}
	}, [initialTitle]);

	// Focus title input when expanded
	useEffect(() => {
		if (isExpanded) {
			titleRef.current?.focus();
		}
	}, [isExpanded]);

	const mutation = trpc.source.importText.useMutation({
		onSuccess: () => {
			utils.source.list.invalidate({ campaignId });
			setTitle("");
			setContent("");
			setIsExpanded(false);
			onClose?.();
		},
	});

	function handleToggle() {
		setIsExpanded((prev) => !prev);
		if (isExpanded) onClose?.();
	}

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		if (!title.trim() || !content.trim()) return;
		mutation.mutate({
			campaignId,
			title: title.trim(),
			content: content.trim(),
		});
	}

	return (
		<div style={{ marginTop: "var(--space-3)" }}>
			<Button
				variant="ghost"
				onClick={handleToggle}
				style={{ color: "var(--accent)", padding: "var(--space-1) 0" }}
			>
				{isExpanded ? "— collapse" : "+ or paste text directly"}
			</Button>

			{isExpanded && (
				<form
					onSubmit={handleSubmit}
					style={{
						marginTop: "var(--space-4)",
						display: "flex",
						flexDirection: "column",
						gap: "var(--space-3)",
						padding: "var(--space-5)",
						backgroundColor: "var(--bg-elevated)",
						borderRadius: "var(--r-md)",
						border: "1px solid var(--border-subtle)",
					}}
				>
					<Input
						ref={titleRef}
						type="text"
						value={title}
						onChange={(e) => setTitle(e.target.value)}
						placeholder="Source title (e.g., 'NPC backstories')"
						style={{ width: "100%", boxSizing: "border-box" }}
						aria-label="Source title"
					/>
					<textarea
						value={content}
						onChange={(e) => setContent(e.target.value)}
						placeholder="Paste your campaign notes, worldbuilding, or session logs here..."
						rows={8}
						style={{
							...inputField,
							width: "100%",
							boxSizing: "border-box",
							resize: "vertical",
							fontFamily: "var(--font-body)",
						}}
						aria-label="Paste content"
					/>
					<div style={{ display: "flex", gap: "var(--space-3)" }}>
						<Button
							type="submit"
							variant="accent"
							disabled={!title.trim() || mutation.isPending}
							loading={mutation.isPending}
						>
							{mutation.isPending ? "Importing…" : "Import text"}
						</Button>
						{mutation.isError && (
							<span
								style={{
									fontSize: "0.8125rem",
									color: "var(--status-error)",
									alignSelf: "center",
								}}
							>
								Failed to import
							</span>
						)}
					</div>
				</form>
			)}
		</div>
	);
}
