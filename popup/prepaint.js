// Pixel Drop — prepaint.js
// Runs before any rendering to prevent theme flash.
// Must be a separate file — inline scripts are blocked by MV3 CSP.

(function () {
  const STORAGE_KEY = "pixeldrop_theme";

  const DARK_BG = {
    win11: "#202020",
    macos: "#1c1c1e",
    default: "#1a1a1a",
  };

  const LIGHT_BG = {
    win11: "#f3f3f3",
    macos: "#ececec",
    default: "#ffffff",
  };

  try {
    const saved = localStorage.getItem(STORAGE_KEY) || "default";
    const prefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)",
    ).matches;
    const bg = (prefersDark ? DARK_BG : LIGHT_BG)[saved] || "#1a1a1a";

    document.documentElement.style.background = bg;
    document.documentElement.style.colorScheme = prefersDark ? "dark" : "light";
  } catch (e) {}
})();
