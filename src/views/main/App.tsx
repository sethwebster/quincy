import { Authenticated, Unauthenticated, AuthLoading } from "convex/react"
import { useQuery, useMutation } from "convex/react"
import type { Id } from "../../../convex/_generated/dataModel"
import { useCallback, useEffect, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { SignIn } from "./auth/SignIn"
import { Sidebar } from "./sidebar/Sidebar"
import { EditorProvider, useEditor } from "./editor/EditorContext"
import { ModeToggle } from "./editor/ModeToggle"
import { Toolbar, type ToolbarAction } from "./editor/Toolbar"
import { RichTextEditor, type RichSearchIndex } from "./editor/RichTextEditor"
import { SplitEditor } from "./editor/SplitEditor"
import { SourceEditor } from "./editor/SourceEditor"
import { FindReplacePanel } from "./editor/FindReplacePanel"
import { useFindReplace } from "./editor/useFindReplace"
import { Spinner } from "./components/Spinner"
import { TrafficLights } from "./components/TrafficLights"
import { api } from "./convexApi"
import { useHotkey } from "./hooks/useHotkey"
import { useWorkspace } from "./sidebar/useWorkspace"
import { useQuickOpen } from "./quickopen/useQuickOpen"
import { QuickOpenModal } from "./quickopen/QuickOpenModal"
import { Minimap } from "./editor/Minimap"
import type { EditorMode } from "../../shared/types"
import type { EditorSelectionRange } from "../../shared/types"

// ── Editor area ────────────────────────────────────────────────────────────

function EditorArea() {
  const {
    mode,
    setMode,
    activeDocumentId,
    activeFilePath,
    content,
    setContent,
    isDirty,
    selections,
    setSelection,
    markClean,
  } = useEditor()
  const editorContainerRef = useRef<HTMLDivElement>(null)
  const [richSearchIndex, setRichSearchIndex] = useState<RichSearchIndex>({ text: "", positions: [] })
  const update = useMutation(api.documents.update)
  const doc = useQuery(
    api.documents.get,
    activeDocumentId ? { id: activeDocumentId as Id<"documents"> } : "skip",
  )
  const activeSelection = selections[mode] ?? null
  const mapRichMatchToSelection = useCallback((match: EditorSelectionRange) => {
    const matchPositions = richSearchIndex.positions.slice(match.from, match.to)
    const from = matchPositions.find((position): position is number => position !== null)
    const toStart = [...matchPositions].reverse().find((position): position is number => position !== null)
    if (from === undefined || toStart === undefined) return null
    return { from, to: toStart + 1 }
  }, [richSearchIndex])
  const findReplace = useFindReplace({
    content,
    searchContent: mode === "rich" ? richSearchIndex.text : content,
    mode,
    selection: activeSelection,
    setContent,
    setSelection,
    mapMatchToSelection: mode === "rich" ? mapRichMatchToSelection : undefined,
  })

  // Load Convex document content into editor when switching docs
  const prevDocId = useRef<string | null>(null)
  useEffect(() => {
    if (doc && activeDocumentId !== prevDocId.current) {
      prevDocId.current = activeDocumentId
      setContent(doc.content)
      markClean()
    }
  }, [doc, activeDocumentId, setContent, markClean])

  // Auto-save Convex doc with debounce (only when a Convex doc is active)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!isDirty || !activeDocumentId || activeFilePath) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      await update({ id: activeDocumentId as Id<"documents">, content })
      markClean()
    }, 800)
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current) }
  }, [content, isDirty, activeDocumentId, activeFilePath, update, markClean])

  function handleToolbarAction(action: ToolbarAction) {
    if (action === "table") {
      const table = "\n| Column 1 | Column 2 |\n| --- | --- |\n| Cell 1 | Cell 2 |\n"
      const insertionPoint = activeSelection?.to ?? content.length
      setContent(content.slice(0, insertionPoint) + table + content.slice(insertionPoint))
      setSelection(mode, { from: insertionPoint + 1, to: insertionPoint + 9 })
    }
  }

  if (!activeDocumentId && !activeFilePath) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
            Open a file or select a document to start writing
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      {findReplace.isOpen && (
        <FindReplacePanel
          query={findReplace.query}
          replacement={findReplace.replacement}
          currentIndex={findReplace.currentIndex}
          matchCount={findReplace.matchCount}
          onQueryChange={findReplace.setQuery}
          onReplacementChange={findReplace.setReplacement}
          onNext={findReplace.findNext}
          onPrevious={findReplace.findPrevious}
          onReplace={findReplace.replaceCurrent}
          onReplaceAll={findReplace.replaceAll}
          onClose={findReplace.close}
        />
      )}
      {/* Toolbar */}
      <Toolbar mode={mode} onAction={handleToolbarAction} />

      {/* Editor content + minimap */}
      <div className="flex min-h-0 flex-1">
        <div ref={editorContainerRef} className="no-drag min-h-0 flex-1 overflow-hidden">
        <AnimatePresence mode="wait" initial={false}>
          {mode === "rich" && (
            <motion.div
              key="rich"
              className="h-full"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <RichTextEditor
                content={content}
                onChange={setContent}
                selection={activeSelection}
                onSelectionChange={(selection) => setSelection("rich", selection)}
                onSearchIndexChange={setRichSearchIndex}
              />
            </motion.div>
          )}
          {mode === "split" && (
            <motion.div
              key="split"
              className="h-full"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <SplitEditor
                content={content}
                onChange={setContent}
                selection={activeSelection}
                onSelectionChange={(selection) => setSelection("split", selection)}
              />
            </motion.div>
          )}
          {mode === "source" && (
            <motion.div
              key="source"
              className="h-full"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <SourceEditor
                content={content}
                onChange={setContent}
                selection={activeSelection}
                onSelectionChange={(selection) => setSelection("source", selection)}
              />
            </motion.div>
          )}
        </AnimatePresence>
        </div>
        {(activeDocumentId || activeFilePath) && (
          <Minimap content={content} editorRef={editorContainerRef} mode={mode} />
        )}
      </div>
    </div>
  )
}

// ── Title bar ──────────────────────────────────────────────────────────────

function TitleBar({ mode, onModeChange }: { mode: EditorMode; onModeChange: (m: EditorMode) => void }) {
  return (
    <div
      className="electrobun-webkit-app-region-drag flex h-11 shrink-0 items-center justify-center px-4 select-none"
      style={{ borderBottom: "1px solid var(--color-glass-border)" }}
    >
      {/* Traffic lights */}
      <div className="w-[72px]">
        <TrafficLights />
      </div>

      {/* Centered mode toggle */}
      <div className="flex flex-1 items-center justify-center">
        <ModeToggle mode={mode} onChange={onModeChange} />
      </div>

      {/* Right zone — save indicator */}
      <div className="w-[72px]" />
    </div>
  )
}

// ── Main app (authenticated) ───────────────────────────────────────────────

function MainApp() {
  const { mode, setMode } = useEditor()
  const { folders } = useWorkspace()
  const quickOpen = useQuickOpen(folders)
  const [sidebarVisible, setSidebarVisible] = useState(true)

  const toggleSidebar = useCallback(() => setSidebarVisible(v => !v), [])
  const openFind = useCallback(() => {
    window.dispatchEvent(new CustomEvent("quincy:find"))
  }, [])
  useHotkey("p", quickOpen.toggle)
  useHotkey("b", toggleSidebar)
  useHotkey("f", openFind)

  useEffect(() => {
    window.addEventListener("quincy:toggleSidebar", toggleSidebar)
    return () => window.removeEventListener("quincy:toggleSidebar", toggleSidebar)
  }, [toggleSidebar])

  return (
    <div className="flex h-full flex-col" style={{ background: "var(--color-surface-1)" }}>
      <TitleBar mode={mode} onModeChange={setMode} />

      <div className="flex min-h-0 flex-1">
        {/* Sidebar */}
        <AnimatePresence initial={false}>
          {sidebarVisible && (
            <motion.div
              key="sidebar"
              className="w-60 shrink-0 overflow-hidden"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 240, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
            >
              <Sidebar />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Editor */}
        <div className="min-w-0 flex-1">
          <EditorArea />
        </div>
      </div>

      <AnimatePresence>
        {quickOpen.isOpen && (
          <QuickOpenModal
            query={quickOpen.query}
            onQueryChange={quickOpen.setQuery}
            results={quickOpen.results}
            selectedIndex={quickOpen.selectedIndex}
            onSelect={(entry) => void quickOpen.selectFile(entry)}
            onKeyDown={quickOpen.handleKeyDown}
            onClose={quickOpen.close}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Root app ───────────────────────────────────────────────────────────────

export function App() {
  return (
    <div className="h-full" style={{ background: "var(--color-surface-0)" }}>
      <AuthLoading>
        <div className="flex h-full items-center justify-center">
          <Spinner size={24} />
        </div>
      </AuthLoading>

      <Unauthenticated>
        <SignIn />
      </Unauthenticated>

      <Authenticated>
        <EditorProvider>
          <MainApp />
        </EditorProvider>
      </Authenticated>
    </div>
  )
}
