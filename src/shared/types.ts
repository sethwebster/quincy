import type { RPCSchema } from "electrobun"

export type EditorMode = "rich" | "split" | "source"

export interface DirEntry {
  name: string
  path: string
  isDirectory: boolean
}

export interface TreeNode {
  name: string
  path: string
  isFolder: boolean
  depth: number
  isExpanded: boolean
}

export interface AppPreferences {
  theme: "dark" | "light" | "system"
  fontSize: number
  fontFamily: string
  defaultEditorMode: EditorMode
  sidebarWidth: number
  workspaceFolders: string[]
}

export const DEFAULT_PREFERENCES: AppPreferences = {
  theme: "dark",
  fontSize: 15,
  fontFamily: "system",
  defaultEditorMode: "split",
  sidebarWidth: 240,
  workspaceFolders: [],
}

export type AppRPC = {
  bun: RPCSchema<{
    requests: {
      getPreferences: { params: Record<string, never>; response: AppPreferences }
      setPreferences: { params: Partial<AppPreferences>; response: void }
      readFile: { params: { path: string }; response: string }
      writeFile: { params: { path: string; content: string }; response: void }
      showOpenDialog: { params: Record<string, never>; response: string | null }
      showSaveDialog: { params: { defaultName: string }; response: string | null }
      showOpenFolderDialog: { params: Record<string, never>; response: string | null }
      listDirectory: { params: { path: string }; response: DirEntry[] }
    }
    messages: {
      log: { msg: string; level: "info" | "warn" | "error" }
    }
  }>
  webview: RPCSchema<{
    requests: Record<string, never>
    messages: {
      themeChanged: { theme: "dark" | "light" }
      workspaceFoldersChanged: { folders: string[] }
    }
  }>
}
