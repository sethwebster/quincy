import type { EditorMode } from "../../../shared/types"
import type {
  ActionPanelItem,
  ActionPanelSettingsState,
  ActionPanelTheme,
  CreateSettingsItemsOptions,
} from "./actionPanelTypes"

const THEME_OPTIONS: readonly { value: ActionPanelTheme; label: string }[] = [
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
  { value: "system", label: "System" },
]

const FONT_OPTIONS: readonly { value: ActionPanelSettingsState["fontFamily"]; label: string }[] = [
  { value: "system", label: "System" },
  { value: "serif", label: "Serif" },
  { value: "mono", label: "Mono" },
]

const MODE_OPTIONS: readonly { value: EditorMode; label: string }[] = [
  { value: "rich", label: "Rich" },
  { value: "split", label: "Split" },
  { value: "source", label: "Source" },
]

function disabledIfCurrent(current: string | undefined, value: string, label: string, noun: string): string | undefined {
  return current === value ? `Already using ${label} ${noun}` : undefined
}

export function createSettingsItems({ settings, update }: CreateSettingsItemsOptions): ActionPanelItem[] {
  const current = settings ?? undefined
  const themeItems = THEME_OPTIONS.map<ActionPanelItem>((option) => ({
    id: `setting:theme:${option.value}`,
    mode: "settings",
    kind: "setting",
    title: `Set appearance to ${option.label}`,
    description: "Change the app theme immediately",
    keywords: ["theme", "appearance", option.label, option.value],
    icon: "setting",
    meta: "Appearance",
    disabledReason: disabledIfCurrent(current?.theme, option.value, option.label, "appearance"),
    setting: { key: "theme", value: option.value },
    perform: () => update("theme", option.value),
  }))

  const fontItems = FONT_OPTIONS.map<ActionPanelItem>((option) => ({
    id: `setting:fontFamily:${option.value}`,
    mode: "settings",
    kind: "setting",
    title: `Set editor font to ${option.label}`,
    description: "Change markdown editor typography",
    keywords: ["font", "editor", option.label, option.value],
    icon: "setting",
    meta: "Editor",
    disabledReason: disabledIfCurrent(current?.fontFamily, option.value, option.label, "editor font"),
    setting: { key: "fontFamily", value: option.value },
    perform: () => update("fontFamily", option.value),
  }))

  const modeItems = MODE_OPTIONS.map<ActionPanelItem>((option) => ({
    id: `setting:defaultEditorMode:${option.value}`,
    mode: "settings",
    kind: "setting",
    title: `Set default mode to ${option.label}`,
    description: "Choose the editor mode restored on launch",
    keywords: ["default", "mode", "launch", option.label, option.value],
    icon: "setting",
    meta: "Editor",
    disabledReason: disabledIfCurrent(current?.defaultEditorMode, option.value, option.label, "default mode"),
    setting: { key: "defaultEditorMode", value: option.value },
    perform: () => update("defaultEditorMode", option.value),
  }))

  return [...themeItems, ...fontItems, ...modeItems]
}
