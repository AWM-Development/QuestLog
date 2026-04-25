import { fireEvent, render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EntityQuickCreatePopover } from "./EntityQuickCreatePopover.js";

const mockCreateEntity = vi.fn().mockResolvedValue({
	id: "new-entity-id",
	name: "St. Andral's Church",
	type: "location",
});

vi.mock("@/lib/trpc.js", () => ({
	trpc: {
		entity: {
			create: {
				useMutation: vi.fn(() => ({
					mutateAsync: mockCreateEntity,
					isPending: false,
				})),
			},
		},
	},
	createTRPCClient: vi.fn(() => ({})),
}));

const defaultProps = {
	spanText: "St. Andral's Church",
	initialType: "location" as const,
	campaignId: "11111111-1111-1111-1111-111111111111",
	position: { top: 100, left: 50 },
	onCreated: vi.fn(),
	onClose: vi.fn(),
};

describe("EntityQuickCreatePopover", () => {
	it("renders type selector buttons for all 5 entity types", () => {
		const { getByRole } = render(<EntityQuickCreatePopover {...defaultProps} />);
		expect(getByRole("button", { name: /^npc$/i })).toBeTruthy();
		expect(getByRole("button", { name: /^faction$/i })).toBeTruthy();
		expect(getByRole("button", { name: /^location$/i })).toBeTruthy();
		expect(getByRole("button", { name: /^item$/i })).toBeTruthy();
		expect(getByRole("button", { name: /^arc$/i })).toBeTruthy();
	});

	it("selecting a type updates the create button label", () => {
		const { getByRole } = render(<EntityQuickCreatePopover {...defaultProps} />);
		const npcBtn = getByRole("button", { name: /^npc$/i });
		fireEvent.click(npcBtn);
		expect(getByRole("button", { name: /create npc/i })).toBeTruthy();
	});

	it("clicking Create calls trpc.entity.create with correct fields and onCreated", async () => {
		const onCreated = vi.fn();
		const { getByRole } = render(
			<EntityQuickCreatePopover {...defaultProps} onCreated={onCreated} />,
		);
		fireEvent.click(getByRole("button", { name: /create location/i }));
		await waitFor(() => {
			expect(mockCreateEntity).toHaveBeenCalledWith(
				expect.objectContaining({
					campaignId: "11111111-1111-1111-1111-111111111111",
					name: "St. Andral's Church",
					type: "location",
				}),
			);
			expect(onCreated).toHaveBeenCalled();
		});
	});
});
