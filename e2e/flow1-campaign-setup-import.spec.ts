// STUB: Generated from PRD §3 Flow 1. Wire selectors after UI stabilises in Milestone 3.3.
// Flow: First Campaign Setup & Import
// PRD reference: §3 Flow 1, §4.1

import { test, expect } from "@playwright/test";

// ── Critical path: upload PDF → ask question → get contextually accurate answer ──
// PRD constraint: this entire flow must complete within 5 minutes for a 200-page module.

describe("Flow 1: First Campaign Setup & Import", () => {
	test("user can create a new campaign with a name, description, and theme", async ({
		page,
	}) => {
		// Navigate to the campaigns list
		await page.goto("/campaigns");

		// Locate and click the "New Campaign" or "Create Campaign" button
		// Assert: campaign creation modal or form is visible
		// Fill in campaign name (required)
		// Fill in optional description
		// Select a theme from the preset list (fantasy, sci-fi, western, horror, modern)
		// Click create / confirm
		// Assert: user is redirected to the new campaign dashboard
		// Assert: campaign name appears in the page heading or breadcrumb
	});

	test("user can upload a PDF file and see it appear in the import queue", async ({
		page,
	}) => {
		// Navigate to a campaign's import/sources view
		// Locate the drag-and-drop upload zone
		// Trigger a file upload with a small test PDF fixture
		// Assert: the uploaded file appears in the import queue list with a "processing" status indicator
	});

	test("user can upload a markdown file and see it appear in the import queue", async ({
		page,
	}) => {
		// Same as above but with a .md fixture file
		// Assert: file is accepted (not rejected) and enters the queue
	});

	test("user can paste raw text directly and it enters the processing pipeline", async ({
		page,
	}) => {
		// Locate the "paste text directly" textarea
		// Type or paste a block of text representing session notes or worldbuilding prose
		// Click the submit / add button
		// Assert: the pasted text appears as a source entry in the sources list
	});

	test("processing indicator shows mascot animation while import is in progress", async ({
		page,
	}) => {
		// After triggering an upload, verify that the processing indicator (mascot / progress bar) is visible
		// This is a visual feedback assertion — the exact selector will depend on the mascot component
		// Assert: mascot is in the "eating scrolls" / importing state
	});

	test("source status transitions to complete and content is queryable", async ({
		page,
	}) => {
		// After a small fixture is processed (wait for status = complete, with timeout)
		// Assert: source row shows a green checkmark or "complete" label
		// Navigate to agent chat and ask a question about the imported content
		// Assert: the agent responds with content that references the imported material
		// Assert: a source citation appears in the response referencing the uploaded file
	});

	test("importing a duplicate file prompts the user with replace / keep both / skip", async ({
		page,
	}) => {
		// Upload the same fixture file a second time
		// Assert: a dialog or prompt appears asking about the duplicate
		// Assert: the prompt offers "Replace", "Keep Both", and "Skip" actions
		// Select "Skip" and verify the original source is unchanged
	});

	test("landing on the campaign dashboard after import shows suggested first questions", async ({
		page,
	}) => {
		// After a campaign has at least one processed source
		// Assert: the campaign dashboard includes a "Your campaign is ready" prompt or similar
		// Assert: suggested first questions are displayed
		// Assert: an import summary (pages / entities detected) is visible
	});
});
