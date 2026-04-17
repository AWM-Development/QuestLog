import { Button } from "@/components/Button.js";
import { Modal } from "@/components/layout/Modal.js";
import {
	FormField,
	Input,
	Select,
	Textarea,
} from "@/components/primitives/index.js";
import { trpc } from "@/lib/trpc.js";
import { CAMPAIGN_THEMES } from "@questlog/shared";
import { type SubmitEvent, useState } from "react";
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

	const createMutation = trpc.campaign.create.useMutation({
		onSuccess: (campaign) => {
			utils.campaign.list.invalidate();
			navigate(`/campaign/${campaign.id}`);
		},
	});

	const handleSubmit = (e: SubmitEvent) => {
		e.preventDefault();
		if (!name.trim()) return;

		createMutation.mutate({
			name: name.trim(),
			description: description.trim() || undefined,
			theme: theme as (typeof CAMPAIGN_THEMES)[number],
			gameSystem: gameSystem.trim() || undefined,
		});
	};

	return (
		<Modal title="Create Campaign" onClose={onClose}>
			<form onSubmit={handleSubmit}>
				<div style={{ marginBottom: "var(--space-4)" }}>
					<FormField label="Name" htmlFor="campaign-name" required>
						<Input
							id="campaign-name"
							type="text"
							required
							maxLength={100}
							value={name}
							onChange={(e) => setName(e.target.value)}
							placeholder="e.g., Curse of Strahd"
							background="var(--bg-void)"
							style={{
								borderRadius: "var(--r-sm)",
								padding: "var(--space-2) var(--space-4)",
							}}
						/>
					</FormField>
				</div>

				<div style={{ marginBottom: "var(--space-4)" }}>
					<FormField label="Description" htmlFor="campaign-description">
						<Textarea
							id="campaign-description"
							maxLength={500}
							rows={3}
							value={description}
							onChange={(e) => setDescription(e.target.value)}
							placeholder="Brief summary of the campaign..."
							background="var(--bg-void)"
							style={{
								width: "100%",
								borderRadius: "var(--r-sm)",
								padding: "var(--space-2) var(--space-4)",
								resize: "vertical",
							}}
						/>
					</FormField>
				</div>

				<div style={{ marginBottom: "var(--space-4)" }}>
					<FormField label="Theme" htmlFor="campaign-theme">
						<Select
							id="campaign-theme"
							value={theme}
							onChange={(e) => setTheme(e.target.value)}
							background="var(--bg-void)"
							style={{
								width: "100%",
								borderRadius: "var(--r-sm)",
								padding: "var(--space-2) var(--space-4)",
							}}
						>
							{CAMPAIGN_THEMES.map((t) => (
								<option key={t} value={t}>
									{t.charAt(0).toUpperCase() + t.slice(1)}
								</option>
							))}
						</Select>
					</FormField>
				</div>

				<div style={{ marginBottom: "var(--space-6)" }}>
					<FormField label="Game System" htmlFor="campaign-game-system">
						<Input
							id="campaign-game-system"
							type="text"
							maxLength={100}
							value={gameSystem}
							onChange={(e) => setGameSystem(e.target.value)}
							placeholder="e.g., D&D 5e, Pathfinder 2e"
							background="var(--bg-void)"
							style={{
								borderRadius: "var(--r-sm)",
								padding: "var(--space-2) var(--space-4)",
							}}
						/>
					</FormField>
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
					<Button
						variant="secondary"
						onClick={onClose}
						disabled={createMutation.isPending}
					>
						Cancel
					</Button>
					<Button
						type="submit"
						variant="accent"
						loading={createMutation.isPending}
						disabled={!name.trim()}
					>
						{createMutation.isPending ? "Creating..." : "Create Campaign"}
					</Button>
				</div>
			</form>
		</Modal>
	);
}
