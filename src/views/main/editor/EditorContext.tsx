import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import type { EditorMode, EditorSelectionRange, EditorSelections, EditorSession } from "../../../shared/types"
import { rpc } from "../rpc/client"

interface EditorState {
  mode: EditorMode
  activeDocumentId: string | null
  activeFilePath: string | null
  content: string
  isDirty: boolean
  selections: EditorSelections
  isRestoring: boolean
}

interface EditorActions {
  setMode: (mode: EditorMode) => void
  setActiveDocumentId: (id: string | null) => void
  openFile: (path: string, content: string) => void
  closeFile: () => void
  setContent: (content: string) => void
  setSelection: (mode: EditorMode, selection: EditorSelectionRange) => void
  markClean: () => void
}

type EditorContextValue = EditorState & EditorActions

const EditorContext = createContext<EditorContextValue | null>(null)

function useFileSave(
  content: string,
  isDirty: boolean,
  activeFilePath: string | null,
  markClean: () => void,
) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!isDirty || !activeFilePath) return
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      void rpc.request.writeFile({ path: activeFilePath, content }).then(markClean)
    }, 800)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [content, isDirty, activeFilePath, markClean])
}

function clampSelection(selection: EditorSelectionRange, content: string): EditorSelectionRange {
  const from = Math.max(0, Math.min(selection.from, content.length))
  const to = Math.max(0, Math.min(selection.to, content.length))
  return { from, to }
}

function useCloseFile(closeFile: () => void) {
  useEffect(() => {
    function handler() { closeFile() }
    window.addEventListener("quincy:closeFile", handler)
    return () => window.removeEventListener("quincy:closeFile", handler)
  }, [closeFile])
}

function useOpenFileRequest(openFile: (path: string, content: string) => void) {
  useEffect(() => {
    let latestRequest = 0

    async function handler(e: Event) {
      const path = (e as CustomEvent<string>).detail
      const request = latestRequest + 1
      latestRequest = request
      const fileContent = await rpc.request.readFile({ path })
      if (request === latestRequest) openFile(path, fileContent)
    }

    window.addEventListener("quincy:openFile", handler)
    return () => {
      latestRequest += 1
      window.removeEventListener("quincy:openFile", handler)
    }
  }, [openFile])
}

function useRestoreEditorSession(
  restoreSession: (session: EditorSession, content?: string) => void,
  markRestoreDone: () => void,
) {
  useEffect(() => {
    let cancelled = false

    async function restore() {
      const prefs = await rpc.request.getPreferences({})
      const session = prefs.editorSession
      if (!session || cancelled) {
        markRestoreDone()
        return
      }

      if (session.activeFilePath) {
        const fileContent = await rpc.request.readFile({ path: session.activeFilePath })
        if (!cancelled) restoreSession(session, fileContent)
      } else if (!cancelled) {
        restoreSession(session)
      }

      if (!cancelled) markRestoreDone()
    }

    void restore()
    return () => {
      cancelled = true
    }
  }, [restoreSession, markRestoreDone])
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

  // Stable content ref for consumers that need latest without re-subscribing
  const contentRef = useRef(content)

  const setMode = useCallback((m: EditorMode) => setModeState(m), [])

  const selectDocument = useCallback((id: string | null) => {
    setActiveDocumentId(id)
    if (id) setActiveFilePath(null)
  }, [])

  const setContent = useCallback((c: string) => {
    contentRef.current = c
    setContentState(c)
    setIsDirty(true)
  }, [])

  const markClean = useCallback(() => setIsDirty(false), [])

  const openFile = useCallback((path: string, fileContent: string) => {
    contentRef.current = fileContent
    setContentState(fileContent)
    setActiveFilePath(path)
    setActiveDocumentId(null)
    setIsDirty(false)
  }, [])

  const closeFile = useCallback(() => {
    contentRef.current = ""
    setContentState("")
    setActiveFilePath(null)
    setActiveDocumentId(null)
    setIsDirty(false)
  }, [])

  const setSelection = useCallback((editorMode: EditorMode, selection: EditorSelectionRange) => {
    setSelections((current) => ({
      ...current,
      [editorMode]: clampSelection(selection, contentRef.current),
    }))
  }, [])

  const restoreSession = useCallback((session: EditorSession, restoredContent = "") => {
    setModeState(session.mode)
    setActiveDocumentId(session.activeDocumentId)
    setActiveFilePath(session.activeFilePath)
    setSelections(session.selections)
    if (session.activeFilePath) {
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

  useFileSave(content, isDirty, activeFilePath, markClean)
  useCloseFile(closeFile)
  useOpenFileRequest(openFile)
  useRestoreEditorSession(restoreSession, markRestoreDone)
  usePersistEditorSession(editorSession, isRestoring)

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
        setMode,
        setActiveDocumentId: selectDocument,
        openFile,
        closeFile,
        setContent,
        setSelection,
        markClean,
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
