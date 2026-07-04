import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import { useConvexAuth, useMutation } from "convex/react"
import type { Id } from "../../../../convex/_generated/dataModel"
import type { EditorMode, EditorSelectionRange, EditorSelections, EditorSession } from "../../../shared/types"
import { api } from "../convexApi"
import { rpc } from "../rpc/client"
import { reportAppError, reportAppMessage } from "../errors"
import { createMarkdownFileIn } from "../files"
import { buildExportHtml } from "../export"
import { useAutoSaveSchedule, useDocumentSaver, useFlushOnQuit } from "./useAutoSave"
import { detectLossyMarkdown } from "./richModeCompat"

/** Imperative handle a mounted editor registers so AI edits flow through its
 *  native undo history (Cmd-Z / Cmd-Shift-Z). Returns true if it applied. */
export interface EditorHandle {
  applyAssistantEdit: (newContent: string) => boolean
}

interface EditorState {
  mode: EditorMode
  activeDocumentId: string | null
  activeFilePath: string | null
  content: string
  isDirty: boolean
  selections: EditorSelections
  isRestoring: boolean
  /** Stable per-document key for the assistant thread, or null if nothing open. */
  docKey: string | null
  /** Human-readable message when the last auto-save failed, else null. */
  saveError: string | null
}

interface EditorActions {
  setMode: (mode: EditorMode) => void
  setActiveDocumentId: (id: string | null) => void
  openFile: (path: string, content: string, mtimeMs: number) => void
  closeFile: () => void
  setContent: (content: string) => void
  setSelection: (mode: EditorMode, selection: EditorSelectionRange) => void
  markClean: () => void
  registerEditorHandle: (handle: EditorHandle | null) => void
  applyAssistantEdit: (newContent: string) => boolean
  /** Latest content, synchronously — ahead of the `content` state during typing. */
  getLatestContent: () => string
}

type EditorContextValue = EditorState & EditorActions

const EditorContext = createContext<EditorContextValue | null>(null)

function basename(path: string): string {
  const parts = path.split("/")
  return parts[parts.length - 1] || path
}

/** Push a debounced snapshot of the open doc to bun so the assistant bridge
 *  (and MCP `get_document`) always sees fresh content. */
function useAssistantDocSync(
  docKey: string | null,
  activeFilePath: string | null,
  content: string,
  selection: EditorSelectionRange | null,
) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!docKey) return
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      rpc.send.syncAssistantDoc({
        docKey,
        path: activeFilePath,
        title: activeFilePath ? basename(activeFilePath) : "Untitled",
        content,
        selection,
      })
    }, 300)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [docKey, activeFilePath, content, selection])
}

function clampSelection(selection: EditorSelectionRange, content: string): EditorSelectionRange {
  const from = Math.max(0, Math.min(selection.from, content.length))
  const to = Math.max(0, Math.min(selection.to, content.length))
  return { from, to }
}

function useFileRenamed(handler: (from: string, to: string) => void) {
  const ref = useRef(handler)
  ref.current = handler
  useEffect(() => {
    function listener(e: Event) {
      const { from, to } = (e as CustomEvent<{ from: string; to: string }>).detail
      ref.current(from, to)
    }
    window.addEventListener("quincy:fileRenamed", listener)
    return () => window.removeEventListener("quincy:fileRenamed", listener)
  }, [])
}

function useFileDeleted(handler: (path: string) => void) {
  const ref = useRef(handler)
  ref.current = handler
  useEffect(() => {
    function listener(e: Event) {
      ref.current((e as CustomEvent<string>).detail)
    }
    window.addEventListener("quincy:fileDeleted", listener)
    return () => window.removeEventListener("quincy:fileDeleted", listener)
  }, [])
}

/** File > Export as HTML: write a standalone .html beside the open .md. */
function useExportHtml(getExportSource: () => { path: string; content: string } | null) {
  const ref = useRef(getExportSource)
  ref.current = getExportSource
  useEffect(() => {
    async function handler() {
      const source = ref.current()
      if (!source) {
        reportAppMessage("Open a local markdown file to export it as HTML.")
        return
      }
      try {
        const htmlPath = source.path.replace(/\.md$/i, "") + ".html"
        const html = buildExportHtml(basename(source.path).replace(/\.md$/i, ""), source.content)
        await rpc.request.writeFile({ path: htmlPath, content: html })
        reportAppMessage(`Exported ${basename(htmlPath)} next to the markdown file.`)
      } catch (error) {
        reportAppError("Couldn't export HTML", error)
      }
    }
    const listener = () => void handler()
    window.addEventListener("quincy:exportHtml", listener)
    return () => window.removeEventListener("quincy:exportHtml", listener)
  }, [])
}

function useCloseFile(closeFile: () => void) {
  useEffect(() => {
    function handler() { closeFile() }
    window.addEventListener("quincy:closeFile", handler)
    return () => window.removeEventListener("quincy:closeFile", handler)
  }, [closeFile])
}

function useNewDocumentRequest(newDocument: () => void) {
  useEffect(() => {
    function handler() { void newDocument() }
    window.addEventListener("quincy:newFile", handler)
    return () => window.removeEventListener("quincy:newFile", handler)
  }, [newDocument])
}

function useOpenFileRequest(openFile: (path: string, content: string, mtimeMs: number) => void) {
  useEffect(() => {
    let latestRequest = 0

    async function handler(e: Event) {
      const path = (e as CustomEvent<string>).detail
      const request = latestRequest + 1
      latestRequest = request
      try {
        const file = await rpc.request.readFile({ path })
        if (request === latestRequest) openFile(path, file.content, file.mtimeMs)
      } catch (error) {
        reportAppError(`Couldn't open ${basename(path)}`, error)
      }
    }

    window.addEventListener("quincy:openFile", handler)
    return () => {
      latestRequest += 1
      window.removeEventListener("quincy:openFile", handler)
    }
  }, [openFile])
}

function useRestoreEditorSession(
  restoreSession: (session: EditorSession, content?: string, mtimeMs?: number) => void,
  markRestoreDone: () => void,
  applyDefaultMode: (mode: EditorMode) => void,
) {
  useEffect(() => {
    let cancelled = false

    async function restore() {
      // The session file pointing at a since-deleted document is normal;
      // start with a blank editor rather than a wedged one. markRestoreDone
      // must ALWAYS run or session persistence stays disabled for the whole
      // app lifetime.
      try {
        const prefs = await rpc.request.getPreferences({})
        const session = prefs.editorSession
        if (!session || cancelled) {
          if (!cancelled) applyDefaultMode(prefs.defaultEditorMode ?? "split")
          return
        }

        if (session.activeFilePath) {
          const file = await rpc.request.readFile({ path: session.activeFilePath })
          if (!cancelled) restoreSession(session, file.content, file.mtimeMs)
        } else if (!cancelled) {
          restoreSession(session)
        }
      } catch {
        // start blank
      } finally {
        if (!cancelled) markRestoreDone()
      }
    }

    void restore()
    return () => {
      cancelled = true
    }
  }, [restoreSession, markRestoreDone, applyDefaultMode])
}

function usePersistEditorSession(session: EditorSession, isRestoring: boolean) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (isRestoring) return
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      void rpc.request.setPreferences({ editorSession: session })
    }, 250)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [session, isRestoring])
}

export function EditorProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<EditorMode>("split")
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null)
  const [activeFilePath, setActiveFilePath] = useState<string | null>(null)
  const [content, setContentState] = useState("")
  const [isDirty, setIsDirty] = useState(false)
  const [selections, setSelections] = useState<EditorSelections>({})
  const [isRestoring, setIsRestoring] = useState(true)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Stable content ref for consumers that need latest without re-subscribing
  const contentRef = useRef(content)

  // The mounted editor's imperative handle (source/split/rich).
  const editorHandleRef = useRef<EditorHandle | null>(null)
  const registerEditorHandle = useCallback((handle: EditorHandle | null) => {
    editorHandleRef.current = handle
  }, [])

  const setMode = useCallback((m: EditorMode) => {
    // Rich mode re-serializes through TipTap's schema on every keystroke;
    // warn before entering it with constructs that won't survive.
    if (m === "rich") {
      const risks = detectLossyMarkdown(contentRef.current)
      if (risks.length > 0) {
        reportAppMessage(
          `Heads up: rich mode can't preserve ${risks.join(", ")} — editing here will drop them. Use Source or Split to keep them intact.`,
        )
      }
    }
    setModeState(m)
  }, [])

  const setContent = useCallback((c: string) => {
    contentRef.current = c
    setContentState(c)
    setIsDirty(true)
  }, [])

  const markClean = useCallback(() => setIsDirty(false), [])

  const getLatestContent = useCallback(() => contentRef.current, [])

  // mtime each open file was read at (or last written with), keyed by path so
  // a pending save flushed after a file switch still guards the right file.
  const fileMtimesRef = useRef(new Map<string, number>())

  // Race-safe auto-save. `onSaved` only marks the document clean when the
  // write that landed matches what's on screen right now (contentRef is
  // updated synchronously in setContent) — content typed during an in-flight
  // write stays dirty and gets its own save. See documentSaver.test.ts.
  const fileSaver = useDocumentSaver({
    write: async (path, fileContent) => {
      const { mtimeMs } = await rpc.request.writeFile({
        path,
        content: fileContent,
        expectedMtimeMs: fileMtimesRef.current.get(path),
      })
      fileMtimesRef.current.set(path, mtimeMs)
    },
    onSaved: (path, savedContent) => {
      if (path === activeFilePath && savedContent === contentRef.current) markClean()
      setSaveError(null)
    },
    onError: (path, error) => {
      const reason = error instanceof Error ? error.message : String(error)
      setSaveError(`Couldn't save ${basename(path)} — ${reason}`)
    },
  })

  const updateDocument = useMutation(api.documents.update)
  const convexSaver = useDocumentSaver({
    write: async (id, docContent) => {
      await updateDocument({ id: id as Id<"documents">, content: docContent })
    },
    onSaved: (id, savedContent) => {
      if (id === activeDocumentId && savedContent === contentRef.current) markClean()
      setSaveError(null)
    },
    onError: (_id, error) => {
      const reason = error instanceof Error ? error.message : String(error)
      setSaveError(`Couldn't sync document — ${reason}`)
    },
  })

  // Persist any pending edits for the outgoing document before switching away.
  const flushSavers = useCallback(() => {
    void fileSaver.flush()
    void convexSaver.flush()
  }, [fileSaver, convexSaver])

  const selectDocument = useCallback((id: string | null) => {
    flushSavers()
    setActiveDocumentId(id)
    if (id) setActiveFilePath(null)
  }, [flushSavers])

  // Apply an AI edit through the mounted editor so it lands in native undo
  // history. Falls back to a plain content swap if no editor is mounted.
  const applyAssistantEdit = useCallback((newContent: string): boolean => {
    const handle = editorHandleRef.current
    if (handle && handle.applyAssistantEdit(newContent)) return true
    setContent(newContent)
    return true
  }, [setContent])

  const openFile = useCallback((path: string, fileContent: string, mtimeMs: number) => {
    flushSavers()
    fileMtimesRef.current.set(path, mtimeMs)
    contentRef.current = fileContent
    setContentState(fileContent)
    setActiveFilePath(path)
    setActiveDocumentId(null)
    setIsDirty(false)
    setSaveError(null)
  }, [flushSavers])

  const closeFile = useCallback(() => {
    flushSavers()
    contentRef.current = ""
    setContentState("")
    setActiveFilePath(null)
    setActiveDocumentId(null)
    setIsDirty(false)
    setSaveError(null)
  }, [flushSavers])

  const { isAuthenticated, isLoading: authLoading } = useConvexAuth()
  const createDocument = useMutation(api.documents.create)
  // Signed in → a synced cloud document. Signed out → a local markdown file
  // in the first workspace folder; local-first must not require an account.
  // While auth is still resolving we don't know which — don't guess wrong.
  const newDocument = useCallback(async () => {
    flushSavers()
    if (authLoading) {
      reportAppMessage("Still connecting — try New File again in a moment.")
      return
    }
    if (isAuthenticated) {
      const id = await createDocument({ title: "Untitled", content: "" })
      contentRef.current = ""
      setContentState("")
      setActiveDocumentId(id)
      setActiveFilePath(null)
      setIsDirty(false)
      setSaveError(null)
      return
    }
    try {
      const currentPrefs = await rpc.request.getPreferences({})
      const folder = currentPrefs.workspaceFolders?.[0]
      if (!folder) {
        reportAppMessage("Add a folder to the sidebar first — New File creates a markdown file there.")
        return
      }
      const { path, mtimeMs } = await createMarkdownFileIn(folder)
      openFile(path, "", mtimeMs)
    } catch (error) {
      reportAppError("Couldn't create a new file", error)
    }
  }, [createDocument, flushSavers, isAuthenticated, authLoading, openFile])

  const setSelection = useCallback((editorMode: EditorMode, selection: EditorSelectionRange) => {
    setSelections((current) => ({
      ...current,
      [editorMode]: clampSelection(selection, contentRef.current),
    }))
  }, [])

  const restoreSession = useCallback((session: EditorSession, restoredContent = "", mtimeMs?: number) => {
    setModeState(session.mode)
    setActiveDocumentId(session.activeDocumentId)
    setActiveFilePath(session.activeFilePath)
    setSelections(session.selections)
    if (session.activeFilePath) {
      if (mtimeMs !== undefined) fileMtimesRef.current.set(session.activeFilePath, mtimeMs)
      contentRef.current = restoredContent
      setContentState(restoredContent)
      setIsDirty(false)
    }
  }, [])

  const markRestoreDone = useCallback(() => setIsRestoring(false), [])

  const editorSession = useMemo<EditorSession>(() => ({
    mode,
    activeDocumentId,
    activeFilePath,
    selections,
  }), [mode, activeDocumentId, activeFilePath, selections])

  const docKey = useMemo<string | null>(() => {
    if (activeDocumentId) return `conv:${activeDocumentId}`
    if (activeFilePath) return `file:${activeFilePath}`
    return null
  }, [activeDocumentId, activeFilePath])

  useAutoSaveSchedule(fileSaver, activeFilePath, content, isDirty && activeFilePath !== null)
  useAutoSaveSchedule(
    convexSaver,
    activeDocumentId,
    content,
    isDirty && activeDocumentId !== null && activeFilePath === null,
  )
  useFlushOnQuit([fileSaver, convexSaver])
  // Keep the open document coherent when the tree renames/deletes files.
  useFileRenamed((from, to) => {
    const mtime = fileMtimesRef.current.get(from)
    if (mtime !== undefined) {
      fileMtimesRef.current.delete(from)
      fileMtimesRef.current.set(to, mtime)
    }
    if (activeFilePath === from) setActiveFilePath(to)
  })
  useFileDeleted((path) => {
    if (activeFilePath === path) closeFile()
  })
  useExportHtml(() =>
    activeFilePath ? { path: activeFilePath, content: contentRef.current } : null,
  )
  useCloseFile(closeFile)
  useNewDocumentRequest(newDocument)
  useOpenFileRequest(openFile)
  useRestoreEditorSession(restoreSession, markRestoreDone, setMode)
  usePersistEditorSession(editorSession, isRestoring)
  useAssistantDocSync(docKey, activeFilePath, content, selections[mode] ?? null)

  return (
    <EditorContext.Provider
      value={{
        mode,
        activeDocumentId,
        activeFilePath,
        content,
        isDirty,
        selections,
        isRestoring,
        docKey,
        saveError,
        setMode,
        setActiveDocumentId: selectDocument,
        openFile,
        closeFile,
        setContent,
        setSelection,
        markClean,
        registerEditorHandle,
        applyAssistantEdit,
        getLatestContent,
      }}
    >
      {children}
    </EditorContext.Provider>
  )
}

export function useEditor() {
  const ctx = useContext(EditorContext)
  if (!ctx) throw new Error("useEditor must be used inside EditorProvider")
  return ctx
}
