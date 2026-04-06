import {
	type ReactNode,
	createContext,
	useCallback,
	useContext,
	useMemo,
	useState,
} from "react";
import { useLocalStorage } from "../features/agent-chat/hooks/useLocalStorage.js";

export type PanelTab = "context" | "notes";

export interface CampaignChromeContextValue {
	panelOpen: boolean;
	panelTab: PanelTab;
	setPanelOpen: (v: boolean) => void;
	setPanelTab: (t: PanelTab) => void;
	openNotes: () => void;
	openContext: () => void;
	togglePanel: () => void;
	activeSessionId: string | null;
	setActiveSessionId: (id: string | null) => void;
	contextPanelContent: ReactNode | null;
	setContextPanelContent: (node: ReactNode | null) => void;
}

const CampaignChromeContext = createContext<CampaignChromeContextValue | null>(
	null,
);

export function CampaignChromeProvider({ children }: { children: ReactNode }) {
	const [panelOpen, setPanelOpen] = useLocalStorage(
		"questlog-panel-open",
		false,
	);
	const [panelTab, setPanelTab] = useLocalStorage<PanelTab>(
		"questlog-panel-tab",
		"notes",
	);
	const [contextPanelContent, setContextPanelContent] =
		useState<ReactNode | null>(null);
	const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

	const openNotes = useCallback(() => {
		setPanelTab("notes");
		setPanelOpen(true);
	}, [setPanelOpen, setPanelTab]);

	const openContext = useCallback(() => {
		setPanelTab("context");
		setPanelOpen(true);
	}, [setPanelOpen, setPanelTab]);

	const togglePanel = useCallback(() => {
		setPanelOpen((o) => !o);
	}, [setPanelOpen]);

	const value = useMemo(
		() => ({
			panelOpen,
			panelTab,
			setPanelOpen,
			setPanelTab,
			openNotes,
			openContext,
			togglePanel,
			activeSessionId,
			setActiveSessionId,
			contextPanelContent,
			setContextPanelContent,
		}),
		[
			panelOpen,
			panelTab,
			setPanelOpen,
			setPanelTab,
			openNotes,
			openContext,
			togglePanel,
			activeSessionId,
			contextPanelContent,
		],
	);

	return (
		<CampaignChromeContext.Provider value={value}>
			{children}
		</CampaignChromeContext.Provider>
	);
}

export function useCampaignChrome(): CampaignChromeContextValue {
	const ctx = useContext(CampaignChromeContext);
	if (!ctx) {
		throw new Error(
			"useCampaignChrome must be used within CampaignChromeProvider",
		);
	}
	return ctx;
}
