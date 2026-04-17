import { type ReactNode, useEffect, useRef } from "react";

interface ModalProps {
	title: string;
	onClose: () => void;
	maxWidth?: number;
	children: ReactNode;
}

export function Modal({
	title,
	onClose,
	maxWidth = 480,
	children,
}: ModalProps) {
	const dialogRef = useRef<HTMLDialogElement>(null);
	const titleId = "modal-title";

	useEffect(() => {
		const dialog = dialogRef.current;
		if (!dialog) return;

		const handleCancel = (e: Event) => {
			e.preventDefault();
			onClose();
		};
		dialog.addEventListener("cancel", handleCancel);

		const firstInput = dialog.querySelector<HTMLElement>(
			"input, textarea, select, button",
		);
		firstInput?.focus();

		return () => dialog.removeEventListener("cancel", handleCancel);
	}, [onClose]);

	return (
		<div
			className="modal-overlay"
			style={{
				position: "fixed",
				inset: 0,
				backgroundColor: "var(--overlay-scrim)",
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				zIndex: 50,
			}}
			onClick={(e) => {
				if (e.target === e.currentTarget) onClose();
			}}
			onKeyDown={(e) => {
				if (e.key === "Escape") {
					e.stopPropagation();
					onClose();
				}
			}}
		>
			<dialog
				ref={dialogRef}
				open
				aria-labelledby={titleId}
				style={{
					backgroundColor: "var(--bg-elevated)",
					borderRadius: "var(--r-lg)",
					padding: "var(--space-8)",
					width: "100%",
					maxWidth,
					boxShadow: "var(--shadow-focal)",
				}}
			>
				<h2
					id={titleId}
					style={{
						fontFamily: "var(--font-display)",
						fontSize: "1.25rem",
						fontWeight: 700,
						marginBottom: "var(--space-6)",
						color: "var(--text-primary)",
					}}
				>
					{title}
				</h2>
				{children}
			</dialog>
		</div>
	);
}
