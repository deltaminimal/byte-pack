// Pixel Drop — downloader.js
// Responsible for orchestrating the download of images from
// a list of tabs. Handles filename extraction, duplicate naming,
// and reporting results back to the popup.

/**
 * Generates a human-readable timestamped filename.
 * Format: pixeldrop-YYYY-MM-DD_HH-MM-SS.mmm.ext
 * Example: pixeldrop-2026-05-25_14-32-07.423.jpg
 *
 * The millisecond component ensures uniqueness even when
 * multiple images are downloaded in rapid succession.
 *
 * @param {string} url - Used only to detect the file extension
 * @returns {string} filename
 */
function extractFilename(url) {
  // Build a readable timestamp
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const mins = String(now.getMinutes()).padStart(2, "0");
  const secs = String(now.getSeconds()).padStart(2, "0");
  const ms = String(now.getMilliseconds()).padStart(3, "0");

  const timestamp = `${year}-${month}-${day}_${hours}-${mins}-${secs}.${ms}`;

  // Try to salvage just the file extension from the URL
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    const ext = pathname.split(".").pop();
    const validExts = [
      "jpg",
      "jpeg",
      "png",
      "gif",
      "webp",
      "bmp",
      "avif",
      "tiff",
    ];

    if (ext && validExts.includes(ext)) {
      return `pixeldrop-${timestamp}.${ext}`;
    }
  } catch {
    // Malformed URL — fall through to default
  }

  // Default fallback — .jpg is the safest assumption
  return `pixeldrop-${timestamp}.jpg`;
}

/**
 * Downloads a single image from a given URL.
 * Duplicate filenames are handled automatically by the browser —
 * Chrome and Edge will append (1), (2) etc. when conflictAction
 * is set to 'uniquify'.
 *
 * @param {string} url - The image URL to download
 * @param {string} [subfolder] - Optional subfolder (Phase 2)
 * @param {string} [filename] - Optional override filename (Phase 2)
 * @returns {Promise<{success: boolean, url: string, error?: string}>}
 */
async function downloadImage(url, subfolder = null, filename = null) {
  try {
    const name = filename || extractFilename(url);

    // If a subfolder is provided (Phase 2), prepend it to the filename
    // e.g. subfolder="Moodboard" → "Moodboard/sunset.jpg"
    const filepath = subfolder ? `${subfolder}/${name}` : name;

    await chrome.downloads.download({
      url: url,
      filename: filepath,
      // 'uniquify' tells the browser to auto-increment duplicate filenames
      // so existing files are never overwritten
      conflictAction: "uniquify",
      saveAs: false,
    });

    return { success: true, url };
  } catch (error) {
    // Capture the error but don't let one failed download
    // stop the rest of the batch
    return { success: false, url, error: error.message };
  }
}

/**
 * Downloads all images from a list of image tabs.
 * Runs sequentially with a small delay between each download
 * to guarantee unique timestamps and avoid any browser-side
 * filename conflicts.
 *
 * @param {chrome.tabs.Tab[]} imageTabs - Tabs identified as images
 * @param {object} [options] - Download options (expanded in Phase 2)
 * @param {string} [options.subfolder] - Optional subfolder name
 * @returns {Promise<{
 *   total: number,
 *   succeeded: number,
 *   failed: number,
 *   errors: string[]
 * }>}
 */
export async function downloadAllImages(imageTabs, options = {}) {
  const { subfolder = null } = options;
  const results = [];

  // Process downloads sequentially with a small stagger
  // instead of all at once — this guarantees each filename
  // gets a unique timestamp and avoids browser conflicts
  for (const tab of imageTabs) {
    const result = await downloadImage(tab.url, subfolder);
    results.push(result);

    // Small delay between downloads — enough to ensure
    // unique timestamps without being noticeable to the user
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  // Summarise results to report back to the popup
  const succeeded = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;
  const errors = results
    .filter((r) => !r.success)
    .map((r) => `${r.url}: ${r.error}`);

  return { total: results.length, succeeded, failed, errors };
}
