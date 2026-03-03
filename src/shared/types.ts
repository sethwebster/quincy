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

export interface WindowFrame {
  x: number
  y: number
  width: number
  height: number
}

export interface AppPreferences {
  theme: "dark" | "light" | "system"
  fontSize: number
  fontFamily: string
  defaultEditorMode: EditorMode
  sidebarWidth: number
  workspaceFolders: string[]
  windowFrame: WindowFrame | null
}

export const DEFAULT_PREFERENCES: AppPreferences = {
  theme: "dark",
  fontSize: 15,
  fontFamily: "system",
  defaultEditorMode: "split",
  sidebarWidth: 240,
  workspaceFolders: [],
  windowFrame: null,
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
      searchFiles: { params: { roots: string[] }; response: DirEntry[] }
      windowClose: { params: Record<string, never>; response: void }
      windowMinimize: { params: Record<string, never>; response: void }
      windowMaximize: { params: Record<string, never>; response: void }
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
      closeFile: Record<string, never>
      reload: Record<string, never>
    }
  }>
}
