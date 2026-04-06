import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AgentMessage } from "./AgentMessage.js";

describe("AgentMessage", () => {
	it("renders the agent label and content", () => {
		render(<AgentMessage content="Hello from the agent" />);
		expect(screen.getByText("QuestLog")).toBeInTheDocument();
		expect(screen.getByText("Hello from the agent")).toBeInTheDocument();
	});

	it("renders bold text with **markdown**", () => {
		render(<AgentMessage content="This is **important** text" />);
		const strong = screen.getByText("important");
		expect(strong.tagName).toBe("STRONG");
	});

	it("renders source chips when sources provided", () => {
		const sources = [
			{ chunkId: "c1", sourceName: "notes.pdf", sourceId: "s1" },
			{ chunkId: "c2", sourceName: "Session 5", sourceId: "s2" },
		];
		render(<AgentMessage content="Answer" sources={sources} />);
		expect(screen.getByText(/notes\.pdf/)).toBeInTheDocument();
		expect(screen.getByText(/Session 5/)).toBeInTheDocument();
	});

	it("renders streaming cursor when isStreaming is true", () => {
		render(<AgentMessage content="Streaming..." isStreaming />);
		const cursor = document.querySelector("[aria-hidden='true']");
		expect(cursor).toBeInTheDocument();
	});

	it("does not render streaming cursor when not streaming", () => {
		render(<AgentMessage content="Done" isStreaming={false} />);
		const cursor = document.querySelector("[aria-hidden='true']");
		expect(cursor).not.toBeInTheDocument();
	});
});
