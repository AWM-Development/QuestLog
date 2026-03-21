import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ChatInput } from "./ChatInput.js";

describe("ChatInput", () => {
	it("renders textarea and send button", () => {
		render(<ChatInput onSend={vi.fn()} />);
		expect(screen.getByRole("textbox")).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "Send message" }),
		).toBeInTheDocument();
	});

	it("sends message on Enter key", () => {
		const onSend = vi.fn();
		render(<ChatInput onSend={onSend} />);
		const textarea = screen.getByRole("textbox");
		fireEvent.change(textarea, { target: { value: "Hello" } });
		fireEvent.keyDown(textarea, { key: "Enter" });
		expect(onSend).toHaveBeenCalledWith("Hello");
	});

	it("does not send on Shift+Enter (inserts newline)", () => {
		const onSend = vi.fn();
		render(<ChatInput onSend={onSend} />);
		const textarea = screen.getByRole("textbox");
		fireEvent.change(textarea, { target: { value: "Hello" } });
		fireEvent.keyDown(textarea, { key: "Enter", shiftKey: true });
		expect(onSend).not.toHaveBeenCalled();
	});

	it("disables send button when input is empty", () => {
		render(<ChatInput onSend={vi.fn()} />);
		const btn = screen.getByRole("button", { name: "Send message" });
		expect(btn).toBeDisabled();
	});

	it("disables input when disabled prop is true", () => {
		render(<ChatInput onSend={vi.fn()} disabled />);
		const textarea = screen.getByRole("textbox");
		expect(textarea).toBeDisabled();
		expect(textarea).toHaveAttribute("placeholder", "Agent is responding...");
	});

	it("clears input after sending", () => {
		const onSend = vi.fn();
		render(<ChatInput onSend={onSend} />);
		const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
		fireEvent.change(textarea, { target: { value: "Hello" } });
		fireEvent.keyDown(textarea, { key: "Enter" });
		expect(textarea.value).toBe("");
	});
});
