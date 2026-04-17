import { Button } from "../../../components/Button.js";

interface SuggestedActionProps {
	label: string;
	onClick: (text: string) => void;
}

export function SuggestedAction({ label, onClick }: SuggestedActionProps) {
	return (
		<Button variant="action" onClick={() => onClick(label)}>
			{label}
		</Button>
	);
}
