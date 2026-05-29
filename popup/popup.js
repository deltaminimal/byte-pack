// Pixel Drop — popup.js
// Handles all popup UI interactions:
// - Initialising the theme on load
// - Proactively scanning tabs on popup open
// - Wiring up the Quick Save and Close Tabs buttons
// - Communicating with the service worker
// - Updating the UI state based on results

import { initTheme } from "../ui/theme.js";

// ─── DOM References ───────────────────────────────────────────
const btnQuickSave = document.getElementById("btn-quick-save");
const btnCloseTabs = document.getElementById("btn-close-tabs");
const btnCloseTabsLabel = document.getElementById("btn-close-tabs-label");
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

// ─── App State ────────────────────────────────────────────────
// Stores tabs from the last successful save so we can close
// exactly those tabs — not a fresh scan
let savedImageTabs = [];

// ─── Button State Management ──────────────────────────────────

/**
 * Single source of truth for button visibility and availability.
 * Call this whenever the button states need to change.
 *
 * @param {'scanning' | 'none_found' | 'ready' | 'downloading' | 'downloaded' | 'done'} phase
 */
function setButtonPhase(phase) {
  // Always start from a known state
  btnQuickSave.disabled = true;
  btnCloseTabs.disabled = true;
  btnQuickSave.classList.remove(
    "pd-btn--hidden",
    "pd-btn--fading-out",
    "pd-btn--visible",
  );
  btnCloseTabs.classList.remove("pd-btn--fading-out", "pd-btn--visible");
  btnCloseTabs.classList.add("pd-btn--hidden");

  switch (phase) {
    case "scanning":
      // Quick Save visible but disabled — scanning in progress
      btnQuickSave.disabled = true;
      break;

    case "none_found":
      // Quick Save visible but disabled — nothing to save
      btnQuickSave.disabled = true;
      break;

    case "ready":
      // Quick Save visible and enabled — images found, ready to save
      btnQuickSave.disabled = false;
      break;

    case "downloading":
      // Quick Save visible but disabled — download in progress
      btnQuickSave.disabled = true;
      break;

    case "downloaded":
      // Quick Save hidden, Close Tabs visible and enabled
      transitionButtons(btnQuickSave, btnCloseTabs);
      btnCloseTabs.disabled = false;
      break;

    case "done":
      // Back to initial state — Quick Save visible but disabled
      // User must reopen popup to start fresh
      btnQuickSave.disabled = true;
      transitionButtons(btnCloseTabs, btnQuickSave);
      break;
  }
}

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

/**
 * Updates the loading message text.
 * @param {string} text
 */
function setLoadingMessage(text) {
  const el = document.querySelector("#state-loading .pd-state__message");
  if (el) el.textContent = text;
}

// ─── Button Transition Animation ──────────────────────────────

/**
 * Animates the transition between two buttons in the footer.
 * Fades the outgoing button up and out, then fades the
 * incoming button up and in.
 *
 * @param {HTMLElement} outgoing - Button to hide
 * @param {HTMLElement} incoming - Button to show
 */
function transitionButtons(outgoing, incoming) {
  outgoing.classList.add("pd-btn--fading-out");

  setTimeout(() => {
    outgoing.classList.add("pd-btn--hidden");
    outgoing.classList.remove("pd-btn--visible", "pd-btn--fading-out");
    incoming.classList.remove("pd-btn--hidden");
    incoming.classList.add("pd-btn--visible");
  }, 250);
}

// ─── Proactive Tab Scanning ───────────────────────────────────

/**
 * Scans tabs as soon as the popup opens and updates the
 * idle state to show how many image tabs are ready.
 * Quick Save is only enabled if images are found.
 */
async function scanOnOpen() {
  setButtonPhase("scanning");
  showState("loading");
  setLoadingMessage("Scanning tabs...");

  try {
    const response = await chrome.runtime.sendMessage({
      action: "QUICK_SAVE_PREVIEW",
    });

    if (response.count === 0) {
      setButtonPhase("none_found");
      showState("none");
    } else {
      msgIdle.textContent =
        response.count === 1
          ? "1 image tab ready to save."
          : `${response.count} image tabs ready to save.`;
      idleIcon.style.display = "flex";
      setButtonPhase("ready");
      showState("idle");
    }
  } catch (error) {
    // Fallback — show idle with button disabled if scan fails
    msgIdle.textContent = "Ready to scan for image tabs.";
    idleIcon.style.display = "flex";
    setButtonPhase("none_found");
    showState("idle");
  }
}

// ─── Open Settings ───────────────────────────────────────────────

/**
 * Handles the Open Settings button click.
 */
function handleOpenSettings() {
  chrome.runtime.openOptionsPage();
}

// ─── Quick Save ───────────────────────────────────────────────

/**
 * Handles the Quick Save button click.
 * Sends the QUICK_SAVE message to the service worker,
 * then updates button phase and UI based on the result.
 */
async function handleQuickSave() {
  setButtonPhase("downloading");
  showState("loading");
  setLoadingMessage("Downloading images...");

  try {
    const response = await chrome.runtime.sendMessage({
      action: "QUICK_SAVE",
      options: {},
    });

    switch (response.status) {
      case "success":
        savedImageTabs = response.imageTabs || [];

        msgSuccess.textContent =
          response.failed > 0
            ? `Saved ${response.succeeded} image${response.succeeded !== 1 ? "s" : ""}. ${response.failed} failed.`
            : `${response.succeeded} image${response.succeeded !== 1 ? "s" : ""} saved successfully!`;

        showState("success");

        if (savedImageTabs.length > 0) {
          btnCloseTabsLabel.textContent =
            savedImageTabs.length === 1
              ? "Close 1 image tab"
              : `Close ${savedImageTabs.length} image tabs`;
          setButtonPhase("downloaded");
        }
        break;

      case "none_found":
        setButtonPhase("none_found");
        showState("none");
        break;

      case "error":
        msgError.textContent =
          response.errors[0] || "Something went wrong. Please try again.";
        setButtonPhase("none_found");
        showState("error");
        break;

      default:
        setButtonPhase("none_found");
        showState("idle");
    }
  } catch (error) {
    msgError.textContent =
      "Could not connect to the extension. Try reloading it.";
    setButtonPhase("none_found");
    showState("error");
  }
}

// ─── Close Tabs ───────────────────────────────────────────────

/**
 * Closes all tabs from the last successful save batch.
 * After closing, resets to the initial disabled state —
 * the user must reopen the popup to start a fresh session.
 */
async function handleCloseTabs() {
  if (savedImageTabs.length === 0) return;

  btnCloseTabs.disabled = true;

  try {
    const tabIds = savedImageTabs.map((tab) => tab.id);
    await chrome.tabs.remove(tabIds);
  } catch (error) {
    // Tabs may have already been closed manually — fail silently
  }

  savedImageTabs = [];
  msgIdle.textContent = "All done! Reopen to start a new session.";
  idleIcon.style.display = "flex";
  showState("idle");
  setButtonPhase("done");
}

// ─── Event Listeners ──────────────────────────────────────────
btnQuickSave.addEventListener("click", handleQuickSave);
btnCloseTabs.addEventListener("click", handleCloseTabs);
btnSettings.addEventListener("click", handleOpenSettings);

// ─── Initialise ───────────────────────────────────────────────
async function init() {
  await initTheme();
  await scanOnOpen();
}

init();
