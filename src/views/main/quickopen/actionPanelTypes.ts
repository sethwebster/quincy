import type { ContentSearchResult, DirEntry, EditorFontFamily, EditorMode } from "../../../shared/types"

export type ActionPanelModeId = "files" | "settings" | "actions" | "ai" | "extensions"

export interface ActionPanelMode {
  id: ActionPanelModeId
  label: string
  description: string
  shortcut: string
}

export type ActionPanelItemKind = "file" | "content" | "setting" | "action" | "ai" | "extension"
export type ActionPanelSettingKey = "theme" | "fontFamily" | "defaultEditorMode"
export type ActionPanelTheme = "dark" | "light" | "system"
export type ActionPanelSettingValue = ActionPanelTheme | EditorFontFamily | EditorMode
export type ActionPanelPerformResult = void | boolean

export interface ActionPanelItem {
  id: string
  mode: ActionPanelModeId
  kind: ActionPanelItemKind
  title: string
  description: string
  keywords: readonly string[]
  perform: () => ActionPanelPerformResult | Promise<ActionPanelPerformResult>
  icon?: "file" | "content" | "setting" | "action" | "ai" | "extension"
  meta?: string
  shortcut?: string
  disabledReason?: string
  setting?: {
    key: ActionPanelSettingKey
    value: ActionPanelSettingValue
  }
  source?: {
    path: string
    lineNumber?: number
  }
}

export interface ActionPanelEmptyState {
  title: string
  description: string
}

export interface ActionPanelSettingsState {
  theme: ActionPanelTheme
  fontFamily: EditorFontFamily
  defaultEditorMode: EditorMode
}

export interface CreateFileItemsOptions {
  files: readonly DirEntry[]
  contentMatches: readonly ContentSearchResult[]
  openFile: (item: ActionPanelItem) => ActionPanelPerformResult | Promise<ActionPanelPerformResult>
}

export interface CreateSettingsItemsOptions {
  settings: ActionPanelSettingsState | null
  update: <K extends ActionPanelSettingKey>(key: K, value: ActionPanelSettingsState[K]) => void | Promise<void>
}

export interface CreateActionItemsOptions {
  hasOpenFile: boolean
  newFile: () => void | Promise<void>
  closeFile: () => void | Promise<void>
  openFind: () => void | Promise<void>
  exportHtml: () => void | Promise<void>
  openSettings: () => void | Promise<void>
  toggleSidebar: () => void | Promise<void>
  toggleAssistant: () => void | Promise<void>
}

export interface CreateAiItemsOptions {
  hasDoc: boolean
  streaming: boolean
  send: (prompt: string) => void | Promise<void>
  revealAssistant?: () => void | Promise<void>
}

export interface ActionPanelExtensionItem {
  id: string
  title: string
  description: string
  keywords?: readonly string[]
  perform: () => ActionPanelPerformResult | Promise<ActionPanelPerformResult>
  shortcut?: string
  disabledReason?: string
}
