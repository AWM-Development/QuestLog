import { Alert } from "@/components/feedback/Alert.js";
import { PageContainer, PageHeader } from "@/components/layout/PageScaffold.js";
import { trpc } from "@/lib/trpc.js";
import { useState } from "react";
import { useParams } from "react-router";
import { useFileUpload } from "../hooks/useFileUpload.js";
import { useSourcePolling } from "../hooks/useSourcePolling.js";
import { FileDropZone } from "./FileDropZone.js";
import { ImportQueue } from "./ImportQueue.js";
import { PasteTextInput } from "./PasteTextInput.js";
import { SourceList } from "./SourceList.js";
import { SuggestedEntities } from "./SuggestedEntities.js";

export function SourcesPage() {
	const { id: campaignId = "" } = useParams<{ id: string }>();
	const { activeSources, completedSources, isLoading, isError } =
		useSourcePolling(campaignId);
	const { uploadFiles, resolveDuplicate, queueItems } =
		useFileUpload(campaignId);
	const utils = trpc.useUtils();
	const deleteSource = trpc.source.delete.useMutation({
		onSuccess: () => utils.source.list.invalidate({ campaignId }),
	});

	const [pasteTextTitle, setPasteTextTitle] = useState<string | undefined>(
		undefined,
	);

	if (isLoading) {
		return (
			<div aria-label="Loading sources">
				{[1, 2, 3].map((i) => (
					<div
						key={i}
						style={{
							height: 72,
							backgroundColor: "var(--bg-elevated)",
							borderRadius: "var(--r-md)",
							marginBottom: "var(--space-3)",
							animation: "pulse 2s ease-in-out infinite",
						}}
					/>
				))}
			</div>
		);
	}

	if (isError) {
		return (
			<Alert>Failed to load sources. Make sure the server is running.</Alert>
		);
	}

	const hasActiveSection = queueItems.length > 0 || activeSources.length > 0;

	return (
		<PageContainer>
			<PageHeader
				title="Import campaign material"
				subtitle="Add documents to your campaign's knowledge base"
			/>

			<div style={{ marginBottom: "var(--space-4)" }}>
				<FileDropZone onFilesSelected={uploadFiles} />
			</div>

			<PasteTextInput
				campaignId={campaignId}
				initialTitle={pasteTextTitle}
				onClose={() => setPasteTextTitle(undefined)}
			/>

			{hasActiveSection && (
				<section style={{ marginTop: "var(--space-8)" }}>
					<h2
						style={{
							fontFamily: "var(--font-display)",
							fontSize: "1rem",
							fontWeight: 600,
							color: "var(--text-secondary)",
							marginBottom: "var(--space-4)",
						}}
					>
						Active imports
					</h2>
					<ImportQueue
						localItems={queueItems}
						activeSources={activeSources}
						onResolveDuplicate={resolveDuplicate}
						onPasteText={setPasteTextTitle}
						onDismissError={(id) => deleteSource.mutate({ id })}
					/>
				</section>
			)}

			<section style={{ marginTop: "var(--space-8)" }}>
				<div
					style={{
						display: "flex",
						alignItems: "baseline",
						gap: "var(--space-3)",
						marginBottom: "var(--space-4)",
					}}
				>
					<h2
						style={{
							fontFamily: "var(--font-display)",
							fontSize: "1rem",
							fontWeight: 600,
							color: "var(--text-secondary)",
						}}
					>
						Campaign sources
					</h2>
					{completedSources.length > 0 && (
						<span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
							{completedSources.length}{" "}
							{completedSources.length === 1 ? "document" : "documents"}
						</span>
					)}
				</div>

				{completedSources.length === 0 ? (
					<p
						style={{
							fontSize: "0.875rem",
							color: "var(--text-muted)",
							fontStyle: "italic",
						}}
					>
						No sources yet — upload files or paste text above to get started.
					</p>
				) : (
					<SourceList sources={completedSources} />
				)}
			</section>

			<section style={{ marginTop: "var(--space-8)" }}>
				<SuggestedEntities />
			</section>
		</PageContainer>
	);
}
