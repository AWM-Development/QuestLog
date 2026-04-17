import { type ReactNode, useEffect, useId, useRef } from "react";

interface ModalProps {
	title: string;
	onClose: () => void;
	maxWidth?: number;
	children: ReactNode;
}

const FOCUSABLE_SELECTOR =
	'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Modal({
	title,
	onClose,
	maxWidth = 480,
	children,
}: ModalProps) {
	const dialogRef = useRef<HTMLDialogElement>(null);
	const titleId = useId();

	useEffect(() => {
		const dialog = dialogRef.current;
		if (!dialog) return;

		const handleCancel = (e: Event) => {
			e.preventDefault();
			onClose();
		};
		dialog.addEventListener("cancel", handleCancel);

		const focusables = dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
		// Prefer the first non-close input; fall back to whatever is focusable.
		const firstField = Array.from(focusables).find(
			(el) => el.getAttribute("aria-label") !== "Close",
		);
		(firstField ?? focusables[0])?.focus();

		return () => dialog.removeEventListener("cancel", handleCancel);
	}, [onClose]);

	const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
		if (e.key === "Escape") {
			e.stopPropagation();
			onClose();
			return;
		}
		if (e.key !== "Tab") return;

		const dialog = dialogRef.current;
		if (!dialog) return;

		const focusables = Array.from(
			dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
		);
		if (focusables.length === 0) return;

		const first = focusables[0];
		const last = focusables[focusables.length - 1];
		const active = document.activeElement as HTMLElement | null;

		if (e.shiftKey && (active === first || !dialog.contains(active))) {
			e.preventDefault();
			last.focus();
		} else if (!e.shiftKey && active === last) {
			e.preventDefault();
			first.focus();
		}
	};

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
			onKeyDown={handleKeyDown}
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
