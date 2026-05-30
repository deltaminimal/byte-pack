# Pixel Drop — Development Guide

This document explains the internal architecture of Pixel Drop, how the modules
connect, the reasoning behind key technical decisions, and notes for future phases.

---

## Architecture Overview

Pixel Drop follows a clean separation of concerns across four layers:

```
UI Layer        popup/ + settings/          What the user sees and interacts with
Logic Layer     core/                       Business logic, no UI dependencies
Orchestration   background/                 Wires everything together
Theming         ui/                         Visual system, independent of logic
```

The core modules have zero UI dependencies — they can be tested independently
and reused across phases without modification.

---

## Module Responsibilities

### manifest.json

The MV3 extension manifest. Defines permissions, the service worker entry point,
the popup HTML, and the settings page. Uses `"type": "module"` on the service
worker to enable ES module imports across all core files.

### background/service-worker.js

The backbone of the extension. Does not perform any logic itself — it listens
for messages from the popup and delegates to the core modules. Keeping it thin
makes it easy to extend without breaking existing functionality.

Supported message actions:

- `QUICK_SAVE` — scan tabs and download all images found
- `QUICK_SAVE_PREVIEW` — scan tabs and return count only, no downloads

### core/tab-scanner.js

Scans all open tabs in the current window and identifies which ones contain
direct image files. Uses a two-step detection strategy:

1. **Fast path** — checks the URL file extension against a known list.
   Zero network cost, instant result.
2. **Slow path** — falls back to a HEAD request via `content-type-checker.js`
   for URLs that have no recognisable image extension.

Internal browser pages (`chrome://`, `edge://`, `about:`) are filtered out
before either check runs.

### core/content-type-checker.js

Sends a `HEAD` request (not `GET`) to a URL and inspects the `Content-Type`
response header. Using `HEAD` is deliberate — it fetches headers only, with
no file body, keeping the check lightweight. CORS failures are caught silently
and return `false` — the tab is simply skipped.

### core/downloader.js

Handles filename generation and download orchestration. Key decisions:

- **Timestamps only** — filenames use the format `pixeldrop-YYYY-MM-DD_HH-MM-SS.mmm.ext`.
  Original URL filenames are ignored because they are typically auto-generated,
  encoded, or meaningless. Custom naming arrives in Phase 2.
- **Extension detection** — the URL is still checked for a file extension so
  downloads land with the correct format (`.jpg`, `.png` etc.).
- **Sequential downloads** — files download one at a time with a 50ms stagger
  rather than all concurrently. This guarantees unique millisecond timestamps
  and avoids browser filename conflicts.
- **`conflictAction: uniquify`** — a safety net on top of the stagger. The
  browser appends `(1)`, `(2)` etc. if a conflict somehow still occurs.
- **Per-file error isolation** — a failed download returns an error object
  rather than throwing, so one bad URL never stops the rest of the batch.

### ui/theme.js

Handles OS detection, theme loading, saving, and applying. Key decisions:

- **Dual storage** — themes are saved to both `chrome.storage.sync` (cross-device
  persistence) and `localStorage` (synchronous pre-paint access).
- **Auto-detection** — on first install, the OS is detected via
  `navigator.userAgentData.platform` with a fallback to `navigator.platform`.
- **Dynamic injection** — themes are applied by injecting a `<link>` tag at
  runtime rather than hardcoding a stylesheet. Swapping themes is instant
  with no page reload required.
- **`data-theme` attribute** — the active theme name is stored on `<html>` as
  a data attribute, enabling theme-specific CSS overrides via attribute selectors.

### popup/prepaint.js and settings/prepaint.js

Loaded as the first `<script>` in each HTML `<head>`. Reads the saved theme
from `localStorage` synchronously before any rendering occurs and sets the
correct background color on `<html>`. Prevents the white or wrong-color flash
that would otherwise appear while the theme CSS file loads asynchronously.
Inline scripts are blocked by MV3's Content Security Policy — a separate file
is required.

### ui/themes/

Three CSS files that define the visual identity of each theme entirely through
CSS custom properties prefixed with `--pd-`. The popup and settings CSS files
never hardcode colors — they only reference these variables. Swapping themes
requires no changes to layout or component styles.

| Theme         | Inspiration             | Font                   |
| ------------- | ----------------------- | ---------------------- |
| `win11.css`   | WinUI 3 / Fluent Design | Segoe UI Variable      |
| `macos.css`   | Apple HIG               | -apple-system / SF Pro |
| `default.css` | Neutral system          | system-ui              |

---

## Data Flow

### Quick Save flow

```
User clicks Quick Save
        │
        ▼
popup.js sends QUICK_SAVE message
        │
        ▼
service-worker.js receives message
        │
        ▼
tab-scanner.js queries all tabs
        │
        ├── Fast path: URL extension check
        └── Slow path: content-type-checker.js HEAD request
        │
        ▼
downloader.js receives image tab list
        │
        ├── Generates timestamped filename
        ├── Calls chrome.downloads.download()
        └── Waits 50ms before next download
        │
        ▼
Result summary returned to popup.js
        │
        ▼
popup.js updates UI state
```

### Theme load flow

```
Page opens (popup or settings)
        │
        ▼
prepaint.js reads localStorage synchronously
Sets correct background on <html> instantly
        │
        ▼
theme.js initTheme() called
        │
        ├── Checks localStorage (fast path)
        └── Falls back to chrome.storage.sync
        │
        ▼
applyTheme() injects <link> tag for correct CSS file
        │
        ▼
Page renders with correct theme, zero flash
```

---

## Key Technical Decisions

| #   | Decision                               | Rationale                                                                                                            |
| --- | -------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| 1   | Manifest V3                            | Required for Chrome and Edge store submission. Service worker replaces persistent background pages.                  |
| 2   | ES Modules                             | `"type": "module"` on the service worker enables clean imports across core files without a bundler.                  |
| 3   | HEAD requests for content-type         | Avoids downloading image bodies during tab scanning. Lightweight and fast.                                           |
| 4   | Sequential downloads with 50ms stagger | Guarantees unique millisecond timestamps. Imperceptible to the user.                                                 |
| 5   | Dual storage for theme                 | `chrome.storage.sync` for cross-device persistence, `localStorage` for synchronous pre-paint access.                 |
| 6   | CSS custom properties for theming      | All three themes share identical component CSS. Only variable definitions differ.                                    |
| 7   | Format conversion via Canvas/Blob      | Chrome Downloads API has no native format conversion. Canvas approach is client-side and dependency-free.            |
| 8   | Settings as a full tab                 | `options_ui` popup mode caused clipping and background window issues in Edge. Tab mode is cleaner and more standard. |
| 9   | Modular core architecture              | Core modules have zero UI dependencies. Easy to test independently and extend for Phase 2 and 3.                     |

---

## Phase 2 — Implementation Notes

When starting Phase 2, the following files are already stubbed and ready:

- `core/format-converter.js` — implement Canvas/Blob conversion here
- `core/downloader.js` — the `options` parameter already accepts `subfolder`
  and is passed through the full call chain. Add `prefix` and `format` here.
- `background/service-worker.js` — add a `QUICK_SAVE_WITH_OPTIONS` handler
  following the same pattern as `QUICK_SAVE`
- `popup/popup.html` and `popup.js` — add subfolder input and prefix input
  to the footer area, pass values in the `options` object
- `settings/settings.html` and `settings.js` — activate the Phase 2 settings
  rows that are currently marked with the Phase 2 badge

---

## Phase 3 — Implementation Notes

- `core/page-scraper.js` — implement `<img>` tag and CSS background extraction here.
  Will require a content script injected into the active tab.
- A content script file will need to be added and registered in `manifest.json`
  under `"content_scripts"`.
- The grid preview UI will likely require a new dedicated HTML page or an
  expanded popup layout — plan for a separate `preview/` folder.
- Noise filtering logic (ads, icons, tracking pixels) should be a separate
  module inside `core/` — e.g. `core/noise-filter.js`.

---

## Running Locally

1. Clone the repository
2. Open `edge://extensions` or `chrome://extensions`
3. Enable Developer Mode
4. Click Load unpacked and select the `pixel-drop/` folder
5. After any code change, click the Reload button on the extension card

---

## Future Design Considerations

### Brand Identity & Custom Accent Colors
Currently the three themes use their respective platform default accent colors:
- Win11: `#0067c0` (Windows 11 default blue)
- macOS: `#007aff` (Apple default blue)
- Default: `#0066cc` (neutral blue)

Once the Pixel Drop brand identity is defined (logo, color palette), a full
theming pass should be done across all three theme files to replace the platform
defaults with Pixel Drop's own accent color. This should be done in one pass
rather than incrementally to keep all themes consistent.

CSS system accent color (`accent-color: auto`) was considered but not implemented
due to browser privacy restrictions preventing reliable access to the OS-level
accent color value. Most users never change their system accent color anyway,
so the platform defaults cover the vast majority of cases well.

### Icon Set
The current icons in `assets/icons/` are placeholder PNGs generated during
initial development. They should be replaced with a proper branded icon set
at the same time as the accent color update, keeping the visual identity
consistent across the toolbar, popup, and store listing.