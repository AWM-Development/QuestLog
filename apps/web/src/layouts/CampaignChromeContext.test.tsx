import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import {
	CampaignChromeProvider,
	useCampaignChrome,
} from "./CampaignChromeContext.js";

function wrapper({ children }: { children: ReactNode }) {
	return <CampaignChromeProvider>{children}</CampaignChromeProvider>;
}

describe("CampaignChromeContext — dock state", () => {
	it("isDocked starts false and activeSessionId starts null", () => {
		const { result } = renderHook(() => useCampaignChrome(), { wrapper });
		expect(result.current.isDocked).toBe(false);
		expect(result.current.activeSessionId).toBeNull();
	});

	it("dockSession(id) sets isDocked=true and activeSessionId", () => {
		const { result } = renderHook(() => useCampaignChrome(), { wrapper });
		act(() => {
			result.current.dockSession("abc");
		});
		expect(result.current.isDocked).toBe(true);
		expect(result.current.activeSessionId).toBe("abc");
	});

	it("undock() sets isDocked=false and preserves activeSessionId for navigation", () => {
		const { result } = renderHook(() => useCampaignChrome(), { wrapper });
		act(() => {
			result.current.dockSession("abc");
		});
		expect(result.current.isDocked).toBe(true);
		act(() => {
			result.current.undock();
		});
		expect(result.current.isDocked).toBe(false);
		// activeSessionId is intentionally preserved after undock so the caller
		// can navigate to the full editor using the id before it clears.
		expect(result.current.activeSessionId).toBe("abc");
	});
});
