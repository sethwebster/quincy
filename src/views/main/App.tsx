import { Authenticated, Unauthenticated, AuthLoading } from "convex/react"
import { useQuery, useMutation } from "convex/react"
import { api } from "../../../convex/_generated/api"
import type { Id } from "../../../convex/_generated/dataModel"
import { useCallback, useEffect, useRef } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { SignIn } from "./auth/SignIn"
import { Sidebar } from "./sidebar/Sidebar"
import { EditorProvider, useEditor } from "./editor/EditorContext"
import { ModeToggle } from "./editor/ModeToggle"
import { Toolbar, type ToolbarAction } from "./editor/Toolbar"
import { RichTextEditor } from "./editor/RichTextEditor"
import { SplitEditor } from "./editor/SplitEditor"
import { SourceEditor } from "./editor/SourceEditor"
import { Spinner } from "./components/Spinner"
import { useHotkey } from "./hooks/useHotkey"
import { useWorkspace } from "./sidebar/useWorkspace"
import { useQuickOpen } from "./quickopen/useQuickOpen"
import { QuickOpenModal } from "./quickopen/QuickOpenModal"
import type { EditorMode } from "../../shared/types"

// ── Editor area ────────────────────────────────────────────────────────────

function EditorArea() {
  const { mode, setMode, activeDocumentId, activeFilePath, content, setContent, isDirty, markClean } = useEditor()
  const update = useMutation(api.documents.update)
  const doc = useQuery(
    api.documents.get,
    activeDocumentId ? { id: activeDocumentId as Id<"documents"> } : "skip",
  )

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
    console.log("toolbar action:", action)
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
    <div className="flex h-full min-h-0 flex-col">
      {/* Toolbar */}
      <Toolbar mode={mode} onAction={handleToolbarAction} />

      {/* Editor content */}
      <div className="no-drag min-h-0 flex-1 overflow-hidden">
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
              <RichTextEditor content={content} onChange={setContent} />
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
              <SplitEditor content={content} onChange={setContent} />
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
              <SourceEditor content={content} onChange={setContent} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

// ── Title bar ──────────────────────────────────────────────────────────────

function TitleBar({ mode, onModeChange }: { mode: EditorMode; onModeChange: (m: EditorMode) => void }) {
  return (
    <div
      className="drag-region flex h-11 shrink-0 items-center justify-center px-4"
      style={{ borderBottom: "1px solid var(--color-glass-border)" }}
    >
      {/* Traffic lights zone (macOS) — 72px reserved */}
      <div className="w-[72px]" />

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

  useHotkey("p", quickOpen.toggle)

  return (
    <div className="flex h-full flex-col" style={{ background: "var(--color-surface-1)" }}>
      <TitleBar mode={mode} onModeChange={setMode} />

      <div className="flex min-h-0 flex-1">
        {/* Sidebar */}
        <div className="w-60 shrink-0">
          <Sidebar />
        </div>

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
