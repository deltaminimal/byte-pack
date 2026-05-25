// Pixel Drop — service-worker.js
// The background service worker is the backbone of the extension.
// It listens for messages from the popup and orchestrates the
// core modules to scan tabs and trigger downloads.

import { scanForImageTabs } from "../core/tab-scanner.js";
import { downloadAllImages } from "../core/downloader.js";

/**
 * Message listener — the popup communicates with the service worker
 * by sending messages via chrome.runtime.sendMessage().
 *
 * Current supported actions:
 *   - 'QUICK_SAVE' → scan all tabs and download all images found
 *
 * Future actions (Phase 2):
 *   - 'QUICK_SAVE_WITH_OPTIONS' → same but with subfolder/rename/conversion options
 *
 * Future actions (Phase 3):
 *   - 'SCRAPE_PAGE' → extract images from the active HTML page
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "QUICK_SAVE") {
    // We need to handle async work inside onMessage.
    // Returning true tells Chrome to keep the message channel
    // open while we do async work — without this, sendResponse
    // would be called on a closed channel and silently fail.
    handleQuickSave(message.options || {}).then(sendResponse);
    return true;
  }
  if (message.action === "QUICK_SAVE_PREVIEW") {
    // Scan tabs and return the count only — no downloads triggered.
    // Used by the popup on open to show how many images are ready.
    handlePreviewScan().then(sendResponse);
    return true;
  }
});

/**
 * Handles the full Quick Save flow:
 * 1. Scan all open tabs for images
 * 2. Download all found images
 * 3. Return a result summary to the popup
 *
 * @param {object} options - Download options (subfolder etc. in Phase 2)
 * @returns {Promise<{
 *   status: 'success' | 'none_found' | 'error',
 *   succeeded: number,
 *   failed: number,
 *   errors: string[]
 * }>}
 */
async function handleQuickSave(options) {
  try {
    // Step 1 — find all image tabs
    const imageTabs = await scanForImageTabs();

    // If no image tabs were found, report back immediately
    if (imageTabs.length === 0) {
      return { status: "none_found", succeeded: 0, failed: 0, errors: [] };
    }

    // Step 2 — download them all
    const result = await downloadAllImages(imageTabs, options);

    return {
      status: "success",
      succeeded: result.succeeded,
      failed: result.failed,
      errors: result.errors,
    };
  } catch (error) {
    // Something unexpected went wrong — report it back to the popup
    return {
      status: "error",
      succeeded: 0,
      failed: 0,
      errors: [error.message],
    };
  }
}
/**
 * Scans tabs and returns only the count of image tabs found.
 * No downloads are triggered — this is purely for the popup
 * preview on open.
 *
 * @returns {Promise<{count: number}>}
 */
async function handlePreviewScan() {
  try {
    const imageTabs = await scanForImageTabs();
    return { count: imageTabs.length };
  } catch {
    return { count: 0 };
  }
}
