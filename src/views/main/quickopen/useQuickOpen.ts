import { useState, useCallback, useRef, useEffect } from "react"
import type { ContentSearchResult, DirEntry } from "../../../shared/types"
import { rpc } from "../rpc/client"
import { reportAppError } from "../errors"
import { useEditor } from "../editor/EditorContext"

/** Unified Quick Open row: a filename match or a full-text content match. */
export type QuickOpenResult =
  | { kind: "file"; path: string; name: string }
  | { kind: "content"; path: string; name: string; lineNumber: number; snippet: string }

const CONTENT_SEARCH_MIN_CHARS = 3
const CONTENT_SEARCH_DEBOUNCE_MS = 150

/** Debounced full-text search over the workspace while the palette is open. */
function useContentSearch(isOpen: boolean, query: string, folders: string[]) {
  const [matches, setMatches] = useState<ContentSearchResult[]>([])
  const requestRef = useRef(0)

  useEffect(() => {
    if (!isOpen || query.trim().length < CONTENT_SEARCH_MIN_CHARS || folders.length === 0) {
      setMatches([])
      return
    }
    const request = requestRef.current + 1
    requestRef.current = request
    const timer = setTimeout(() => {
      rpc.request
        .searchContent({ roots: folders, query: query.trim() })
        .then((found) => {
          if (requestRef.current === request) setMatches(found)
        })
        .catch((error) => reportAppError("Content search failed", error))
    }, CONTENT_SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [isOpen, query, folders])

  return matches
}

/** Char offset of the first hit of `query` on `lineNumber` (1-based) in `content`. */
function offsetOfMatch(content: string, lineNumber: number, query: string): { from: number; to: number } | null {
  const lines = content.split("\n")
  const line = lines[lineNumber - 1]
  if (line === undefined) return null
  let offset = 0
  for (let i = 0; i < lineNumber - 1; i += 1) offset += (lines[i] ?? "").length + 1
  const index = line.toLowerCase().indexOf(query.toLowerCase())
  const from = offset + Math.max(0, index)
  return { from, to: index === -1 ? from : from + query.length }
}

export function useQuickOpen(folders: string[]) {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [allFiles, setAllFiles] = useState<DirEntry[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const { mode, openFile, setSelection } = useEditor()
  const loadedRef = useRef(false)

  const open = useCallback(() => {
    setIsOpen(true)
    setQuery("")
    setSelectedIndex(0)
    loadedRef.current = false
  }, [])

  const close = useCallback(() => {
    setIsOpen(false)
    setQuery("")
    setAllFiles([])
    loadedRef.current = false
  }, [])

  const toggle = useCallback(() => {
    setIsOpen((prev) => {
      if (prev) {
        setQuery("")
        setAllFiles([])
        loadedRef.current = false
        return false
      }
      loadedRef.current = false
      setQuery("")
      setSelectedIndex(0)
      return true
    })
  }, [])

  // Fetch file list when opened
  useEffect(() => {
    if (!isOpen || loadedRef.current || folders.length === 0) return
    loadedRef.current = true
    rpc.request
      .searchFiles({ roots: folders })
      .then(setAllFiles)
      .catch((error) => reportAppError("Couldn't index workspace files", error))
  }, [isOpen, folders])

  const contentMatches = useContentSearch(isOpen, query, folders)

  const fileResults: QuickOpenResult[] = (
    query.length === 0
      ? allFiles
      : allFiles.filter((f) => {
          const q = query.toLowerCase()
          return f.name.toLowerCase().includes(q) || f.path.toLowerCase().includes(q)
        })
  ).map((f) => ({ kind: "file" as const, path: f.path, name: f.name }))

  const results: QuickOpenResult[] = [
    ...fileResults,
    ...contentMatches.map((m) => ({ kind: "content" as const, ...m })),
  ]

  const selectResult = useCallback(
    async (result: QuickOpenResult) => {
      try {
        const file = await rpc.request.readFile({ path: result.path })
        openFile(result.path, file.content, file.mtimeMs)
        // Jump to the matched line. Rich mode positions don't map to markdown
        // offsets, so the jump only applies in source/split.
        if (result.kind === "content" && mode !== "rich") {
          const range = offsetOfMatch(file.content, result.lineNumber, query.trim())
          if (range) setSelection(mode, range)
        }
        close()
      } catch (error) {
        reportAppError(`Couldn't open ${result.name}`, error)
      }
    },
    [openFile, close, mode, query, setSelection],
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault()
        setSelectedIndex((i) => Math.min(i + 1, results.length - 1))
      } else if (e.key === "ArrowUp") {
        e.preventDefault()
        setSelectedIndex((i) => Math.max(i - 1, 0))
      } else if (e.key === "Enter") {
        e.preventDefault()
        const selected = results[selectedIndex]
        if (selected) void selectResult(selected)
      } else if (e.key === "Escape") {
        e.preventDefault()
        close()
      }
    },
    [results, selectedIndex, selectResult, close],
  )

  // Reset index when query changes
  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  return {
    isOpen,
    query,
    setQuery,
    results,
    selectedIndex,
    open,
    close,
    toggle,
    selectResult,
    handleKeyDown,
  }
}
