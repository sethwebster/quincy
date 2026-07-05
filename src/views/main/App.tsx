import { useConvexAuth, useQuery } from "convex/react"
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
import { api } from "./convexApi"
import { useHotkey } from "./hooks/useHotkey"
import { useAppErrorBanner } from "./hooks/useAppErrorBanner"
import { SettingsModal } from "./settings/SettingsModal"
import { useSettingsModal } from "./settings/useSettings"
import { useWorkspace } from "./sidebar/useWorkspace"
import { useQuickOpen } from "./quickopen/useQuickOpen"
import { QuickOpenModal } from "./quickopen/QuickOpenModal"
import { Minimap } from "./editor/Minimap"
import { AssistantPanel } from "./assistant/AssistantPanel"
import { useAssistant } from "./assistant/useAssistant"
import type { EditorMode } from "../../shared/types"
import type { EditorSelectionRange } from "../../shared/types"
import { useMarkdownAttachmentResolver } from "./editor/useMarkdownAttachmentResolver"

// ── Editor area ────────────────────────────────────────────────────────────

/** Load the Convex document's content into the editor when switching docs. */
function useConvexDocLoad(
  doc: { content: string } | null | undefined,
  activeDocumentId: string | null,
  setContent: (content: string) => void,
  markClean: () => void,
) {
  const prevDocId = useRef<string | null>(null)
  useEffect(() => {
    if (doc && activeDocumentId !== prevDocId.current) {
      prevDocId.current = activeDocumentId
      setContent(doc.content)
      markClean()
    }
  }, [doc, activeDocumentId, setContent, markClean])
}

function EditorArea() {
  const {
    mode,
    setMode,
    activeDocumentId,
    activeFilePath,
    content,
    setContent,
    selections,
    setSelection,
    markClean,
    saveError,
  } = useEditor()
  const editorContainerRef = useRef<HTMLDivElement>(null)
  const [richSearchIndex, setRichSearchIndex] = useState<RichSearchIndex>({ text: "", positions: [] })
  const { isAuthenticated } = useConvexAuth()
  const doc = useQuery(
    api.documents.get,
    activeDocumentId && isAuthenticated ? { id: activeDocumentId as Id<"documents"> } : "skip",
  )
  const activeSelection = selections[mode] ?? null
  const { resolveAttachments, storageModal } = useMarkdownAttachmentResolver(activeFilePath)
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

  useConvexDocLoad(doc, activeDocumentId, setContent, markClean)

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
      {saveError && (
        <div
          role="alert"
          className="absolute bottom-3 left-1/2 z-50 -translate-x-1/2 rounded-lg border px-3 py-1.5 text-xs backdrop-blur-md"
          style={{
            background: "rgba(127, 29, 29, 0.75)",
            borderColor: "rgba(248, 113, 113, 0.4)",
            color: "rgb(254, 226, 226)",
          }}
        >
          {saveError}
        </div>
      )}
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
                key={activeFilePath ?? activeDocumentId ?? "rich-empty"}
                content={content}
                activeFilePath={activeFilePath}
                onChange={setContent}
                selection={activeSelection}
                onSelectionChange={(selection) => setSelection("rich", selection)}
                onSearchIndexChange={setRichSearchIndex}
                onResolveAttachments={resolveAttachments}
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
                activeFilePath={activeFilePath}
                onChange={setContent}
                selection={activeSelection}
                onSelectionChange={(selection) => setSelection("split", selection)}
                onResolveAttachments={resolveAttachments}
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
                onResolveAttachments={resolveAttachments}
              />
            </motion.div>
          )}
        </AnimatePresence>
        </div>
        {(activeDocumentId || activeFilePath) && (
          <Minimap content={content} editorRef={editorContainerRef} mode={mode} />
        )}
      </div>
      {storageModal}
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
      {/* Reserve space for native macOS traffic lights (inset by hiddenInset) */}
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
  const settingsModal = useSettingsModal()
  // Hoisted so assistant RPC listeners (incl. the edit-apply ack) stay alive
  // while the panel is hidden.
  const assistant = useAssistant()
  const [sidebarVisible, setSidebarVisible] = useState(true)
  const [assistantVisible, setAssistantVisible] = useState(false)

  const toggleSidebar = useCallback(() => setSidebarVisible(v => !v), [])
  const toggleAssistant = useCallback(() => setAssistantVisible(v => !v), [])
  const showAssistant = useCallback(() => setAssistantVisible(true), [])
  const openSettings = useCallback(() => {
    window.dispatchEvent(new CustomEvent("quincy:showSettings"))
  }, [])
  const openFind = useCallback(() => {
    window.dispatchEvent(new CustomEvent("quincy:find"))
  }, [])
  const quickOpen = useQuickOpen(folders, {
    openSettings,
    openFind,
    toggleSidebar,
    toggleAssistant,
    showAssistant,
    assistant,
    extensionItems: [],
  })
  useHotkey("p", quickOpen.toggle)
  useHotkey("b", toggleSidebar)
  useHotkey("j", toggleAssistant)
  useHotkey("f", openFind)

  useEffect(() => {
    window.addEventListener("quincy:toggleSidebar", toggleSidebar)
    return () => window.removeEventListener("quincy:toggleSidebar", toggleSidebar)
  }, [toggleSidebar])

  useEffect(() => {
    window.addEventListener("quincy:toggleAssistant", toggleAssistant)
    return () => window.removeEventListener("quincy:toggleAssistant", toggleAssistant)
  }, [toggleAssistant])

  useEffect(() => {
    window.addEventListener("quincy:toggleQuickOpen", quickOpen.toggle)
    return () => window.removeEventListener("quincy:toggleQuickOpen", quickOpen.toggle)
  }, [quickOpen.toggle])

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

        {/* Assistant panel */}
        <AnimatePresence initial={false}>
          {assistantVisible && (
            <motion.div
              key="assistant"
              className="shrink-0 overflow-hidden"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 360, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
            >
              <div className="h-full w-[360px]">
                <AssistantPanel onClose={toggleAssistant} assistant={assistant} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AppErrorBanner />

      <AnimatePresence>
        {settingsModal.visible && <SettingsModal onClose={settingsModal.close} />}
      </AnimatePresence>

      <AnimatePresence>
        {quickOpen.isOpen && (
          <QuickOpenModal
            modes={quickOpen.modes}
            activeMode={quickOpen.activeMode}
            onModeChange={quickOpen.setActiveMode}
            query={quickOpen.query}
            onQueryChange={quickOpen.setQuery}
            items={quickOpen.items}
            selectedIndex={quickOpen.selectedIndex}
            emptyState={quickOpen.emptyState}
            onSelect={quickOpen.selectItem}
            onKeyDown={quickOpen.handleKeyDown}
            onClose={quickOpen.close}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

/** Sign-in is opt-in: shown as an overlay when the sidebar asks for it,
 *  auto-dismissed once authentication succeeds. */
function useSignInModal() {
  const [visible, setVisible] = useState(false)
  const { isAuthenticated } = useConvexAuth()

  useEffect(() => {
    const show = () => setVisible(true)
    window.addEventListener("quincy:showSignIn", show)
    return () => window.removeEventListener("quincy:showSignIn", show)
  }, [])

  useEffect(() => {
    if (isAuthenticated) setVisible(false)
  }, [isAuthenticated])

  return { visible, close: useCallback(() => setVisible(false), []) }
}

function SignInModal() {
  const { visible, close } = useSignInModal()
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-0 z-50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <SignIn />
          <button
            type="button"
            onClick={close}
            aria-label="Close sign in"
            className="no-drag absolute right-4 top-4 rounded-lg px-3 py-1.5 text-xs"
            style={{
              color: "var(--color-text-secondary)",
              border: "1px solid var(--color-glass-border)",
              background: "var(--color-glass)",
            }}
          >
            Not now
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/** Transient banner for failures reported via `reportAppError`. */
function AppErrorBanner() {
  const message = useAppErrorBanner()
  if (!message) return null
  return (
    <div
      role="alert"
      className="absolute top-12 left-1/2 z-50 -translate-x-1/2 rounded-lg border px-3 py-1.5 text-xs backdrop-blur-md"
      style={{
        background: "rgba(127, 29, 29, 0.75)",
        borderColor: "rgba(248, 113, 113, 0.4)",
        color: "rgb(254, 226, 226)",
      }}
    >
      {message}
    </div>
  )
}

// ── Root app ───────────────────────────────────────────────────────────────

export function App() {
  // Local-first: the editor works without an account. Sign-in is an opt-in
  // overlay that unlocks cloud documents and persisted assistant threads.
  return (
    <div className="h-full" style={{ background: "var(--color-surface-0)" }}>
      <EditorProvider>
        <MainApp />
        <SignInModal />
      </EditorProvider>
    </div>
  )
}
