# Pixel Drop

> Bulk-download images open in separate browser tabs with one click.

Pixel Drop is a Chrome and Microsoft Edge extension for designers, researchers,
and anyone who opens images in separate tabs and wants to save them all at once
without right-clicking each one individually.

---

## Features

- **One-click Quick Save** — scans all open tabs and downloads every image instantly
- **Smart detection** — identifies image tabs by URL extension and HTTP Content-Type header
- **Clean filenames** — timestamped names with correct file extensions, no conflicts
- **Proactive scan** — shows how many image tabs are ready before you click anything
- **Theme system** — Windows 11, macOS, and System Default themes, auto-detected on install
- **Settings panel** — manual theme override, persisted across devices via browser sync

---

## Installation (Developer Mode)

Pixel Drop is not yet published to the Chrome Web Store or Edge Add-ons.
To run it locally:

1. Clone or download this repository
2. Open Chrome and go to `chrome://extensions` or Edge and go to `edge://extensions`
3. Enable **Developer Mode**
4. Click **Load unpacked**
5. Select the `pixel-drop/` folder

The extension will appear in your toolbar immediately.

---

## How It Works

1. Open images in separate tabs — direct image URLs like `domain.com/photo.jpg`
2. Click the **Pixel Drop** icon in the toolbar
3. The popup shows how many image tabs were detected
4. Click **Quick Save** — all images download to your default downloads folder

---

## Permissions

Pixel Drop requests the following permissions:

| Permission         | Why                                                                                    |
| ------------------ | -------------------------------------------------------------------------------------- |
| `tabs`             | Read open tab URLs to detect which ones contain images                                 |
| `downloads`        | Trigger file downloads                                                                 |
| `storage`          | Save your theme and settings preferences                                               |
| `activeTab`        | Access the currently active tab when needed                                            |
| `host_permissions` | Fetch HTTP Content-Type headers to detect image tabs whose URLs have no file extension |

No data is collected, stored externally, or transmitted anywhere.
All processing happens entirely within your browser.

---

## Project Structure

```
pixel-drop/
├── manifest.json               # MV3 extension manifest
├── background/
│   └── service-worker.js       # Orchestrates tab scanning and downloads
├── core/
│   ├── tab-scanner.js          # Detects image tabs (extension + content-type)
│   ├── downloader.js           # Download orchestration and filename generation
│   ├── content-type-checker.js # HEAD request content-type detection
│   ├── format-converter.js     # Phase 2 — format conversion (stub)
│   └── page-scraper.js         # Phase 3 — HTML page image extraction (stub)
├── popup/
│   ├── popup.html              # Toolbar popup UI
│   ├── popup.js                # Popup logic and state management
│   ├── popup.css               # Popup styles
│   └── prepaint.js             # Pre-paint theme flash prevention
├── settings/
│   ├── settings.html           # Settings page
│   ├── settings.js             # Settings logic
│   ├── settings.css            # Settings styles
│   └── prepaint.js             # Pre-paint theme flash prevention
├── ui/
│   ├── theme.js                # Theme detection, loading, and applying
│   └── themes/
│       ├── win11.css           # Windows 11 Fluent Design theme
│       ├── macos.css           # macOS HIG theme
│       └── default.css         # System default theme
└── assets/
    └── icons/                  # Extension icons (16, 32, 48, 128px)
```

---

## Roadmap

| Phase       | Features                                            | Status      |
| ----------- | --------------------------------------------------- | ----------- |
| **Phase 1** | Quick Save, smart tab detection, theme system       | ✅ Complete |
| **Phase 2** | Custom subfolder, batch renaming, format conversion | 🔲 Planned  |
| **Phase 3** | HTML page scraping, noise filtering, grid preview   | 🔲 Planned  |

---

## Development Notes

For a detailed explanation of the architecture, module responsibilities,
and technical decisions, see [DEVELOPMENT.md](DEVELOPMENT.md).
