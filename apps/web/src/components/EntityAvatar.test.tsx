import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EntityAvatar, getEntityPalette } from "./EntityAvatar.js";

describe("EntityAvatar", () => {
	it("renders the first character of name uppercased", () => {
		render(<EntityAvatar name="goblin" entityType="npc" />);
		expect(screen.getByText("G")).toBeInTheDocument();
	});

	it("applies npc background color", () => {
		const { container } = render(<EntityAvatar name="Test" entityType="npc" />);
		const el = container.firstChild as HTMLElement;
		expect(el).toHaveStyle({
			backgroundColor: "var(--ent-npc-bg)",
		});
	});

	it("applies faction background color", () => {
		const { container } = render(
			<EntityAvatar name="Test" entityType="faction" />,
		);
		const el = container.firstChild as HTMLElement;
		expect(el).toHaveStyle({
			backgroundColor: "var(--ent-faction-bg)",
		});
	});

	it("renders with default size 30", () => {
		const { container } = render(<EntityAvatar name="Test" entityType="npc" />);
		const el = container.firstChild as HTMLElement;
		expect(el).toHaveStyle({ width: "30px", height: "30px" });
	});

	it("accepts custom size", () => {
		const { container } = render(
			<EntityAvatar name="Test" entityType="npc" size={24} />,
		);
		const el = container.firstChild as HTMLElement;
		expect(el).toHaveStyle({ width: "24px", height: "24px" });
	});

	it("renders a fallback glyph when name is empty", () => {
		render(<EntityAvatar name="" entityType="npc" />);
		expect(screen.getByText("?")).toBeInTheDocument();
	});

	it("getEntityPalette returns tokenized colors for a type", () => {
		expect(getEntityPalette("npc")).toEqual({
			backgroundColor: "var(--ent-npc-bg)",
			color: "var(--ent-npc)",
		});
	});
});
