import { useState, useCallback, useEffect, useMemo } from "react"
import { rpc } from "../rpc/client"
import { reportAppError } from "../errors"
import { useEditor } from "../editor/EditorContext"
import { useSettings } from "../settings/useSettings"
import {
  ACTION_PANEL_MODES,
  actionPanelEmptyState,
  createActionItems,
  createAiItems,
  createExtensionItems,
  createFileItems,
  createSettingsItems,
  executeActionPanelItem,
  filterActionPanelItems,
  moveActionPanelSelection,
  normalizeActionPanelSelection,
  type ActionPanelExtensionItem,
  type ActionPanelItem,
  type ActionPanelModeId,
} from "./actionPanelModel"
import { useActionPanelFileIndex } from "./useActionPanelFileIndex"
import { findContentMatchRange, useActionPanelContentSearch } from "./useActionPanelContentSearch"

const ACTION_PANEL_RESULT_LIMIT = 100

interface UseQuickOpenOptions {
  openSettings: () => void
  openFind: () => void
  toggleSidebar: () => void
  toggleAssistant: () => void
  showAssistant: () => void
  assistant: {
    hasDoc: boolean
    streaming: boolean
    send: (question: string) => void
  }
  extensionItems?: readonly ActionPanelExtensionItem[]
}

function emitAppEvent(name: string): void {
  window.dispatchEvent(new CustomEvent(name))
}

export function useQuickOpen(folders: string[], options: UseQuickOpenOptions) {
  const [isOpen, setIsOpen] = useState(false)
  const [activeMode, setActiveModeState] = useState<ActionPanelModeId>("files")
  const [query, setQueryState] = useState("")
  const [selectedIndex, setSelectedIndex] = useState(0)
  const {
    mode,
    activeDocumentId,
    activeFilePath,
    openFile,
    closeFile,
    setSelection,
  } = useEditor()
  const settings = useSettings(isOpen)
  const {
    files,
    invalidate: invalidateFileIndex,
    reset: resetFileIndex,
  } = useActionPanelFileIndex(isOpen, folders)

  const open = useCallback(() => {
    setIsOpen(true)
    setActiveModeState("files")
    setQueryState("")
    setSelectedIndex(0)
    invalidateFileIndex()
  }, [invalidateFileIndex])

  const close = useCallback(() => {
    setIsOpen(false)
    setQueryState("")
    resetFileIndex()
  }, [resetFileIndex])

  const toggle = useCallback(() => {
    setIsOpen((prev) => {
      if (prev) {
        setQueryState("")
        resetFileIndex()
        return false
      }
      invalidateFileIndex()
      setActiveModeState("files")
      setQueryState("")
      setSelectedIndex(0)
      return true
    })
  }, [invalidateFileIndex, resetFileIndex])

  const setActiveMode = useCallback((nextMode: ActionPanelModeId) => {
    setActiveModeState(nextMode)
    setSelectedIndex(0)
  }, [])

  const setQuery = useCallback((nextQuery: string) => {
    setQueryState(nextQuery)
    setSelectedIndex(0)
  }, [])

  const cycleMode = useCallback((delta: number) => {
    setActiveModeState((currentMode) => {
      const currentIndex = ACTION_PANEL_MODES.findIndex((panelMode) => panelMode.id === currentMode)
      const nextIndex = (currentIndex + delta + ACTION_PANEL_MODES.length) % ACTION_PANEL_MODES.length
      setSelectedIndex(0)
      return ACTION_PANEL_MODES[nextIndex]?.id ?? "files"
    })
  }, [])

  const contentMatches = useActionPanelContentSearch(isOpen && activeMode === "files", query, folders)

  const openFileItem = useCallback(
    async (item: ActionPanelItem) => {
      try {
        if (!item.source) return false
        const file = await rpc.request.readFile({ path: item.source.path })
        openFile(item.source.path, file.content, file.mtimeMs)
        if (item.kind === "content" && item.source.lineNumber !== undefined && mode !== "rich") {
          const range = findContentMatchRange(file.content, item.source.lineNumber, query.trim())
          if (range) setSelection(mode, range)
        }
        return true
      } catch (error) {
        reportAppError(`Couldn't open ${item.title}`, error)
        return false
      }
    },
    [query, mode, openFile, setSelection],
  )

  const allItemsByMode = useMemo<Record<ActionPanelModeId, ActionPanelItem[]>>(() => {
    const hasOpenDocument = activeDocumentId !== null || activeFilePath !== null
    return {
      files: createFileItems({ files, contentMatches, openFile: openFileItem }),
      settings: createSettingsItems({ settings: settings.settings, update: settings.update }),
      actions: createActionItems({
        hasOpenFile: hasOpenDocument,
        newFile: () => emitAppEvent("quincy:newFile"),
        closeFile,
        openFind: options.openFind,
        exportHtml: () => emitAppEvent("quincy:exportHtml"),
        openSettings: options.openSettings,
        toggleSidebar: options.toggleSidebar,
        toggleAssistant: options.toggleAssistant,
      }),
      ai: createAiItems({
        hasDoc: options.assistant.hasDoc,
        streaming: options.assistant.streaming,
        send: options.assistant.send,
        revealAssistant: options.showAssistant,
      }),
      extensions: createExtensionItems(options.extensionItems ?? []),
    }
  }, [
    activeDocumentId,
    activeFilePath,
    closeFile,
    contentMatches,
    files,
    openFileItem,
    options.assistant.hasDoc,
    options.assistant.send,
    options.assistant.streaming,
    options.extensionItems,
    options.openFind,
    options.openSettings,
    options.showAssistant,
    options.toggleAssistant,
    options.toggleSidebar,
    settings.settings,
    settings.update,
  ])

  const items = useMemo(
    () => filterActionPanelItems(allItemsByMode[activeMode], query).slice(0, ACTION_PANEL_RESULT_LIMIT),
    [activeMode, allItemsByMode, query],
  )
  const selectedItem = selectedIndex >= 0 ? items[selectedIndex] : undefined

  const selectItem = useCallback(
    async (item: ActionPanelItem | undefined) => {
      if (!item) return
      if (item.mode !== activeMode || !items.some((currentItem) => currentItem.id === item.id)) return
      const executed = await executeActionPanelItem(item)
      if (executed) close()
    },
    [activeMode, close, items],
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const numericMode = ACTION_PANEL_MODES.find((panelMode) => e.metaKey && e.key === panelMode.shortcut)
      if (numericMode) {
        e.preventDefault()
        setActiveMode(numericMode.id)
        return
      }

      if (e.key === "ArrowDown") {
        e.preventDefault()
        setSelectedIndex((i) => moveActionPanelSelection(items, i, 1))
      } else if (e.key === "ArrowUp") {
        e.preventDefault()
        setSelectedIndex((i) => moveActionPanelSelection(items, i, -1))
      } else if (e.key === "ArrowRight" && e.metaKey) {
        e.preventDefault()
        cycleMode(1)
      } else if (e.key === "ArrowLeft" && e.metaKey) {
        e.preventDefault()
        cycleMode(-1)
      } else if (e.key === "Tab") {
        e.preventDefault()
        cycleMode(e.shiftKey ? -1 : 1)
      } else if (e.key === "Home") {
        e.preventDefault()
        setSelectedIndex(normalizeActionPanelSelection(items, 0))
      } else if (e.key === "End") {
        e.preventDefault()
        setSelectedIndex(normalizeActionPanelSelection(items, items.length - 1))
      } else if (e.key === "Enter") {
        e.preventDefault()
        void selectItem(selectedItem)
      } else if (e.key === "Escape") {
        e.preventDefault()
        close()
      }
    },
    [close, cycleMode, items, selectItem, selectedItem, setActiveMode],
  )

  useEffect(() => {
    setSelectedIndex((current) => normalizeActionPanelSelection(items, current))
  }, [items])

  return {
    isOpen,
    activeMode,
    modes: ACTION_PANEL_MODES,
    query,
    setQuery,
    items,
    selectedIndex,
    selectedItem,
    emptyState: actionPanelEmptyState(activeMode),
    open,
    close,
    toggle,
    setActiveMode,
    cycleMode,
    selectItem,
    handleKeyDown,
  }
}
