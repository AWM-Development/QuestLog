import { buttonAccent, buttonSecondary } from "@/components/styles.js";
import { trpc } from "@/lib/trpc.js";
import { CAMPAIGN_THEMES } from "@questlog/shared";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";

interface CampaignCreateModalProps {
	onClose: () => void;
}

export function CampaignCreateModal({ onClose }: CampaignCreateModalProps) {
	const navigate = useNavigate();
	const utils = trpc.useUtils();

	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const [theme, setTheme] = useState<string>("fantasy");
	const [gameSystem, setGameSystem] = useState("");

	const dialogRef = useRef<HTMLDialogElement>(null);

	const createMutation = trpc.campaign.create.useMutation({
		onSuccess: (campaign) => {
			utils.campaign.list.invalidate();
			navigate(`/campaign/${campaign.id}`);
		},
	});

	useEffect(() => {
		const dialog = dialogRef.current;
		if (!dialog) return;

		const handleCancel = (e: Event) => {
			e.preventDefault();
			onClose();
		};
		dialog.addEventListener("cancel", handleCancel);

		// Focus the first input
		const firstInput = dialog.querySelector("input");
		firstInput?.focus();

		return () => dialog.removeEventListener("cancel", handleCancel);
	}, [onClose]);

	const handleSubmit = (e: FormEvent) => {
		e.preventDefault();
		if (!name.trim()) return;

		createMutation.mutate({
			name: name.trim(),
			description: description.trim() || undefined,
			theme: theme as (typeof CAMPAIGN_THEMES)[number],
			gameSystem: gameSystem.trim() || undefined,
		});
	};

	const inputStyle = {
		width: "100%",
		padding: "var(--space-2) var(--space-4)",
		backgroundColor: "var(--bg-void)",
		border: "1px solid var(--border)",
		borderRadius: "var(--r-sm)",
		color: "var(--text-primary)",
		fontSize: "0.875rem",
		fontFamily: "var(--font-body)",
	};

	const labelStyle = {
		display: "block",
		fontSize: "0.875rem",
		fontWeight: 600 as const,
		color: "var(--text-secondary)",
		marginBottom: "var(--space-1)",
	};

	return (
		<div
			className="modal-overlay"
			style={{
				position: "fixed",
				inset: 0,
				backgroundColor: "rgba(9, 13, 18, 0.92)",
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
				aria-labelledby="create-campaign-title"
				style={{
					backgroundColor: "var(--bg-elevated)",
					borderRadius: "var(--r-lg)",
					padding: "var(--space-8)",
					width: "100%",
					maxWidth: 480,
					boxShadow: "var(--shadow-focal)",
				}}
			>
				<h2
					id="create-campaign-title"
					style={{
						fontFamily: "var(--font-display)",
						fontSize: "1.25rem",
						fontWeight: 700,
						marginBottom: "var(--space-6)",
						color: "var(--text-primary)",
					}}
				>
					Create Campaign
				</h2>

				<form onSubmit={handleSubmit}>
					<div style={{ marginBottom: "var(--space-4)" }}>
						<label htmlFor="campaign-name" style={labelStyle}>
							Name *
						</label>
						<input
							id="campaign-name"
							type="text"
							required
							maxLength={100}
							value={name}
							onChange={(e) => setName(e.target.value)}
							placeholder="e.g., Curse of Strahd"
							style={inputStyle}
						/>
					</div>

					<div style={{ marginBottom: "var(--space-4)" }}>
						<label htmlFor="campaign-description" style={labelStyle}>
							Description
						</label>
						<textarea
							id="campaign-description"
							maxLength={500}
							rows={3}
							value={description}
							onChange={(e) => setDescription(e.target.value)}
							placeholder="Brief summary of the campaign..."
							style={{ ...inputStyle, resize: "vertical" }}
						/>
					</div>

					<div style={{ marginBottom: "var(--space-4)" }}>
						<label htmlFor="campaign-theme" style={labelStyle}>
							Theme
						</label>
						<select
							id="campaign-theme"
							value={theme}
							onChange={(e) => setTheme(e.target.value)}
							style={inputStyle}
						>
							{CAMPAIGN_THEMES.map((t) => (
								<option key={t} value={t}>
									{t.charAt(0).toUpperCase() + t.slice(1)}
								</option>
							))}
						</select>
					</div>

					<div style={{ marginBottom: "var(--space-6)" }}>
						<label htmlFor="campaign-game-system" style={labelStyle}>
							Game System
						</label>
						<input
							id="campaign-game-system"
							type="text"
							maxLength={100}
							value={gameSystem}
							onChange={(e) => setGameSystem(e.target.value)}
							placeholder="e.g., D&D 5e, Pathfinder 2e"
							style={inputStyle}
						/>
					</div>

					{createMutation.isError && (
						<p
							role="alert"
							style={{
								color: "var(--status-error)",
								fontSize: "0.875rem",
								marginBottom: "var(--space-4)",
							}}
						>
							{createMutation.error.message}
						</p>
					)}

					<div
						style={{
							display: "flex",
							justifyContent: "flex-end",
							gap: "var(--space-4)",
						}}
					>
						<button
							type="button"
							onClick={onClose}
							disabled={createMutation.isPending}
							style={buttonSecondary}
						>
							Cancel
						</button>
						<button
							type="submit"
							disabled={createMutation.isPending || !name.trim()}
							style={{
								...buttonAccent,
								cursor:
									createMutation.isPending || !name.trim()
										? "not-allowed"
										: "pointer",
								opacity: createMutation.isPending || !name.trim() ? 0.5 : 1,
							}}
						>
							{createMutation.isPending ? "Creating..." : "Create Campaign"}
						</button>
					</div>
				</form>
			</dialog>
		</div>
	);
}
