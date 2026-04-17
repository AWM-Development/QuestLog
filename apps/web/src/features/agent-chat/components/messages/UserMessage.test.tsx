import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { UserMessage } from "./UserMessage.js";

describe("UserMessage", () => {
	it("renders the message content", () => {
		render(<UserMessage content="Hello world" />);
		expect(screen.getByText("Hello world")).toBeInTheDocument();
	});

	it("preserves whitespace and newlines", () => {
		render(<UserMessage content={"Line 1\nLine 2"} />);
		const el = screen.getByText(/Line 1/);
		expect(el).toHaveStyle({ whiteSpace: "pre-wrap" });
	});

	it("applies right-aligned styling", () => {
		render(<UserMessage content="test" />);
		const el = screen.getByText("test");
		expect(el).toHaveStyle({ marginLeft: "auto" });
	});
});
