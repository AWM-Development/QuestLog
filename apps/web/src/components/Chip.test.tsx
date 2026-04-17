import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Chip } from "./Chip.js";

describe("Chip", () => {
	it("renders children", () => {
		render(<Chip variant="tag">combat</Chip>);
		expect(screen.getByText("combat")).toBeInTheDocument();
	});

	it("entity variant with entityType=npc applies npc background color", () => {
		render(
			<Chip variant="entity" entityType="npc">
				Guard
			</Chip>,
		);
		const chip = screen.getByText("Guard");
		expect(chip).toHaveStyle({ backgroundColor: "var(--ent-npc-bg)" });
	});

	it("entity variant with entityType=faction applies faction background", () => {
		render(
			<Chip variant="entity" entityType="faction">
				Guild
			</Chip>,
		);
		expect(screen.getByText("Guild")).toHaveStyle({
			backgroundColor: "var(--ent-faction-bg)",
		});
	});

	it("tag variant applies chipBase sizing", () => {
		render(<Chip variant="tag">stealth</Chip>);
		const chip = screen.getByText("stealth");
		expect(chip).toHaveStyle({ borderRadius: "var(--r-sm)" });
	});

	it("badge variant applies accent-muted background", () => {
		render(<Chip variant="badge">Fantasy</Chip>);
		const chip = screen.getByText("Fantasy");
		expect(chip).toHaveStyle({ backgroundColor: "var(--accent-muted)" });
	});

	it("pill variant applies pill border-radius", () => {
		render(<Chip variant="pill">Active</Chip>);
		const chip = screen.getByText("Active");
		expect(chip).toHaveStyle({ borderRadius: "var(--r-pill)" });
	});
});
