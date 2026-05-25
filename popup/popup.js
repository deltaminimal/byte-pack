// Pixel Drop — popup.js
// Handles all popup UI interactions:
// - Initialising the theme on load
// - Proactively scanning tabs on popup open
// - Wiring up the Quick Save button
// - Communicating with the service worker
// - Updating the UI state based on results

import { initTheme } from "../ui/theme.js";

// ─── DOM References ───────────────────────────────────────────
const btnQuickSave = document.getElementById("btn-quick-save");
const btnSettings = document.getElementById("btn-settings");

const stateIdle = document.getElementById("state-idle");
const stateLoading = document.getElementById("state-loading");
const stateSuccess = document.getElementById("state-success");
const stateNone = document.getElementById("state-none");
const stateError = document.getElementById("state-error");

const msgIdle = document.getElementById("msg-idle");
const msgSuccess = document.getElementById("msg-success");
const msgError = document.getElementById("msg-error");
const idleIcon = document.getElementById("idle-icon");

// ─── State Management ─────────────────────────────────────────

/**
 * Hides all state panels and shows only the requested one.
 *
 * @param {'idle' | 'loading' | 'success' | 'none' | 'error'} state
 */
function showState(state) {
  const states = {
    idle: stateIdle,
    loading: stateLoading,
    success: stateSuccess,
    none: stateNone,
    error: stateError,
  };

  Object.values(states).forEach((el) => el.classList.add("pd-state--hidden"));

  if (states[state]) {
    states[state].classList.remove("pd-state--hidden");
  }
}

// ─── Proactive Tab Scanning ───────────────────────────────────

/**
 * Scans tabs as soon as the popup opens and updates the
 * idle state to show how many image tabs are ready.
 * Disables the Quick Save button if none are found.
 *
 * This gives the user immediate feedback without having
 * to click anything first.
 */
async function scanOnOpen() {
  // Show spinner while scanning
  showState("loading");
  msgLoading("Scanning tabs...");

  try {
    const response = await chrome.runtime.sendMessage({
      action: "QUICK_SAVE_PREVIEW",
    });

    if (response.count === 0) {
      // No images found — show none state and disable button
      btnQuickSave.disabled = true;
      showState("none");
    } else {
      // Images found — update idle state with count
      const label =
        response.count === 1
          ? "1 image tab ready to save."
          : `${response.count} image tabs ready to save.`;

      msgIdle.textContent = label;

      // Ensure the icon is visible and styled correctly
      idleIcon.style.display = "flex";
      btnQuickSave.disabled = false;
      showState("idle");
    }
  } catch (error) {
    // If preview scan fails, fall back to a generic ready message
    // so the user can still attempt a save
    msgIdle.textContent = "Ready to save all image tabs.";
    btnQuickSave.disabled = false;
    showState("idle");
  }
}

/**
 * Updates the loading message text.
 * @param {string} text
 */
function msgLoading(text) {
  const el = document.querySelector("#state-loading .pd-state__message");
  if (el) el.textContent = text;
}

// ─── Quick Save ───────────────────────────────────────────────

/**
 * Handles the Quick Save button click.
 * Sends a message to the service worker and updates
 * the UI based on the response.
 */
async function handleQuickSave() {
  btnQuickSave.disabled = true;
  showState("loading");
  msgLoading("Downloading images...");

  try {
    const response = await chrome.runtime.sendMessage({
      action: "QUICK_SAVE",
      options: {},
    });

    switch (response.status) {
      case "success":
        msgSuccess.textContent =
          response.failed > 0
            ? `Saved ${response.succeeded} image${response.succeeded !== 1 ? "s" : ""}. ${response.failed} failed.`
            : `${response.succeeded} image${response.succeeded !== 1 ? "s" : ""} saved successfully!`;
        showState("success");
        break;

      case "none_found":
        showState("none");
        break;

      case "error":
        msgError.textContent =
          response.errors[0] || "Something went wrong. Please try again.";
        showState("error");
        break;

      default:
        showState("idle");
    }
  } catch (error) {
    msgError.textContent =
      "Could not connect to the extension. Try reloading it.";
    showState("error");
  }

  // Re-enable after a delay so user can run another save
  setTimeout(() => {
    btnQuickSave.disabled = false;
  }, 2000);
}

// ─── Settings ─────────────────────────────────────────────────

function handleOpenSettings() {
  chrome.runtime.openOptionsPage();
}

// ─── Event Listeners ──────────────────────────────────────────
btnQuickSave.addEventListener("click", handleQuickSave);
btnSettings.addEventListener("click", handleOpenSettings);

// ─── Initialise ───────────────────────────────────────────────
async function init() {
  await initTheme();
  await scanOnOpen();
}

init();
