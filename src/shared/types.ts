import type { RPCSchema } from "electrobun"

export type UpdateStatusType =
  | "idle" | "checking" | "check-complete" | "no-update" | "update-available"
  | "downloading" | "download-starting" | "download-progress" | "download-complete"
  | "decompressing" | "applying" | "extracting" | "replacing-app"
  | "launching-new-version" | "complete" | "error"

export interface UpdateStatusPayload {
  status: UpdateStatusType
  message: string
  progress?: number
  errorMessage?: string
}

export type EditorMode = "rich" | "split" | "source"

export type EditorFontFamily = "system" | "serif" | "mono"
export type MarkdownAttachmentStorageMode = "sidecar" | "inline"

// ─── Assistant ──────────────────────────────────────────────────────────────

export type AssistantBackend = "claude" | "codex"

export interface AssistantToolUse {
  id: string
  label: string
}

export interface AssistantMessage {
  id: string
  turnId: string
  role: "user" | "assistant"
  content: string
  streaming?: boolean
  error?: string
  toolUses?: AssistantToolUse[]
}

/** A prior turn sent back to the CLI as context. */
export interface AssistantHistoryTurn {
  role: "user" | "assistant"
  content: string
}

/** Live snapshot of the open document, cached by the bun bridge. */
export interface AssistantDocSnapshot {
  docKey: string
  path: string | null
  title: string
  content: string
  selection: EditorSelectionRange | null
}

/** A live edit request flowing MCP server → bridge → renderer. */
export interface AssistantEdit {
  editId: string
  content: string
  /** The document this edit targets; the renderer rejects it if another
   *  document is open by the time it arrives. */
  docKey: string
  /** The content the edit was computed from; the renderer rejects the edit if
   *  the user typed in the meantime instead of silently clobbering it. */
  baseContent: string
}

export interface EditorSelectionRange {
  from: number
  to: number
}

/** File content plus the mtime it was read at, so writes can detect that the
 *  file changed on disk in the meantime instead of clobbering it. */
export interface FileReadResult {
  content: string
  mtimeMs: number
}

/** A full-text match inside a workspace markdown file. */
export interface ContentSearchResult {
  path: string
  name: string
  lineNumber: number
  snippet: string
}

export type EditorSelections = Partial<Record<EditorMode, EditorSelectionRange>>

export interface EditorSession {
  mode: EditorMode
  activeDocumentId: string | null
  activeFilePath: string | null
  selections: EditorSelections
}

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
  fontFamily: EditorFontFamily
  defaultEditorMode: EditorMode
  markdownAttachmentStorageMode: MarkdownAttachmentStorageMode | null
  editorSession: EditorSession | null
  sidebarWidth: number
  workspaceFolders: string[]
  windowFrame: WindowFrame | null
}

export const DEFAULT_PREFERENCES: AppPreferences = {
  theme: "dark",
  fontSize: 15,
  fontFamily: "system",
  defaultEditorMode: "split",
  markdownAttachmentStorageMode: null,
  editorSession: null,
  sidebarWidth: 240,
  workspaceFolders: [],
  windowFrame: null,
}

export type AppRPC = {
  bun: RPCSchema<{
    requests: {
      getPreferences: { params: Record<string, never>; response: AppPreferences }
      setPreferences: { params: Partial<AppPreferences>; response: void }
      readFile: { params: { path: string }; response: FileReadResult }
      readMarkdownImage: { params: { markdownPath: string; imageUrl: string }; response: string | null }
      writeMarkdownAttachment: {
        params: { markdownPath: string; name: string; mimeType: string; base64Data: string }
        response: string
      }
      writeFile: {
        params: { path: string; content: string; expectedMtimeMs?: number }
        response: { mtimeMs: number }
      }
      showOpenDialog: { params: Record<string, never>; response: string | null }
      showOpenFolderDialog: { params: Record<string, never>; response: string | null }
      listDirectory: { params: { path: string }; response: DirEntry[] }
      searchFiles: { params: { roots: string[] }; response: DirEntry[] }
      searchContent: { params: { roots: string[]; query: string }; response: ContentSearchResult[] }
      renameFile: { params: { path: string; newName: string }; response: { newPath: string } }
      deleteFile: { params: { path: string }; response: void }
      checkForUpdates: { params: Record<string, never>; response: void }
      applyUpdate: { params: Record<string, never>; response: void }
      assistantBackends: { params: Record<string, never>; response: { claude: boolean; codex: boolean } }
    }
    messages: {
      log: { msg: string; level: "info" | "warn" | "error" }
      rendererReady: Record<string, never>
      syncAssistantDoc: AssistantDocSnapshot
      assistantAsk: {
        turnId: string
        backend: AssistantBackend
        question: string
        history: AssistantHistoryTurn[]
      }
      assistantCancel: { turnId: string }
      assistantEditApplied: { editId: string; ok: boolean; error?: string }
    }
  }>
  webview: RPCSchema<{
    requests: Record<string, never>
    messages: {
      themeChanged: { theme: "dark" | "light" | "system" }
      workspaceFoldersChanged: { folders: string[] }
      closeFile: Record<string, never>
      toggleQuickOpen: Record<string, never>
      exportHtml: Record<string, never>
      showSettings: Record<string, never>
      newFile: Record<string, never>
      openFile: { path: string }
      find: Record<string, never>
      reload: Record<string, never>
      toggleSidebar: Record<string, never>
      toggleAssistant: Record<string, never>
      updateStatus: UpdateStatusPayload
      assistantChunk: { turnId: string; delta: string }
      assistantToolUse: { turnId: string; toolUseId: string; label: string }
      assistantDone: { turnId: string }
      assistantError: { turnId: string; message: string }
      assistantApplyEdit: AssistantEdit
    }
  }>
}
