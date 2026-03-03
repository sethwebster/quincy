import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react"
import type { EditorMode } from "../../../shared/types"
import { rpc } from "../rpc/client"

interface EditorState {
  mode: EditorMode
  activeDocumentId: string | null
  activeFilePath: string | null
  content: string
  isDirty: boolean
}

interface EditorActions {
  setMode: (mode: EditorMode) => void
  setActiveDocumentId: (id: string | null) => void
  openFile: (path: string, content: string) => void
  closeFile: () => void
  setContent: (content: string) => void
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

export function EditorProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<EditorMode>("split")
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null)
  const [activeFilePath, setActiveFilePath] = useState<string | null>(null)
  const [content, setContentState] = useState("")
  const [isDirty, setIsDirty] = useState(false)

  // Stable content ref for consumers that need latest without re-subscribing
  const contentRef = useRef(content)

  const setMode = useCallback((m: EditorMode) => setModeState(m), [])

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

  useFileSave(content, isDirty, activeFilePath, markClean)

  useEffect(() => {
    function handler() { closeFile() }
    window.addEventListener("quincy:closeFile", handler)
    return () => window.removeEventListener("quincy:closeFile", handler)
  }, [closeFile])

  return (
    <EditorContext.Provider
      value={{
        mode,
        activeDocumentId,
        activeFilePath,
        content,
        isDirty,
        setMode,
        setActiveDocumentId,
        openFile,
        closeFile,
        setContent,
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
