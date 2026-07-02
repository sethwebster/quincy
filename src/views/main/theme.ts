/** Applies the user's appearance preference to the document.
 *  "system" tracks macOS via prefers-color-scheme and re-applies on change. */

export type ThemePreference = "dark" | "light" | "system"

let currentPreference: ThemePreference = "dark"
const lightMedia = window.matchMedia("(prefers-color-scheme: light)")

function resolve(preference: ThemePreference): "dark" | "light" {
  if (preference === "system") return lightMedia.matches ? "light" : "dark"
  return preference
}

export function applyTheme(preference: ThemePreference): void {
  currentPreference = preference
  document.documentElement.setAttribute("data-theme", resolve(preference))
}

lightMedia.addEventListener("change", () => applyTheme(currentPreference))

/** Applies the editor font preference; CSS maps data-font to --font-editor. */
export function applyEditorFont(font: "system" | "serif" | "mono"): void {
  document.documentElement.setAttribute("data-font", font)
}
