import type { ActionPanelEmptyState, ActionPanelMode, ActionPanelModeId } from "./actionPanelTypes"

export const ACTION_PANEL_MODES: readonly ActionPanelMode[] = [
  { id: "files", label: "Files", description: "Open markdown files and content hits", shortcut: "1" },
  { id: "settings", label: "Settings", description: "Set editor preferences", shortcut: "2" },
  { id: "actions", label: "Actions", description: "Run app commands", shortcut: "3" },
  { id: "ai", label: "AI", description: "Ask the document assistant", shortcut: "4" },
  { id: "extensions", label: "Extensions", description: "Run registered extension actions", shortcut: "5" },
] as const

const EMPTY_STATES: Record<ActionPanelModeId, ActionPanelEmptyState> = {
  files: {
    title: "No files found",
    description: "Add a folder or refine the search to switch files.",
  },
  settings: {
    title: "No settings match",
    description: "Search theme, editor font, or default mode settings.",
  },
  actions: {
    title: "No actions match",
    description: "Search commands like find, export, sidebar, or assistant.",
  },
  ai: {
    title: "No AI prompts match",
    description: "Search summarize, rewrite, grammar, or title prompts.",
  },
  extensions: {
    title: "No extensions registered",
    description: "Extension actions can be added through the action panel item registry.",
  },
}

export function actionPanelEmptyState(mode: ActionPanelModeId): ActionPanelEmptyState {
  return EMPTY_STATES[mode]
}
