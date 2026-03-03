import { useState, useCallback, useRef, useEffect } from "react"
import type { DirEntry } from "../../../shared/types"
import { rpc } from "../rpc/client"
import { useEditor } from "../editor/EditorContext"

export function useQuickOpen(folders: string[]) {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [allFiles, setAllFiles] = useState<DirEntry[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const { openFile } = useEditor()
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
    void rpc.request.searchFiles({ roots: folders }).then(setAllFiles)
  }, [isOpen, folders])

  const results = query.length === 0
    ? allFiles
    : allFiles.filter((f) => {
        const q = query.toLowerCase()
        return f.name.toLowerCase().includes(q) || f.path.toLowerCase().includes(q)
      })

  const selectFile = useCallback(
    async (entry: DirEntry) => {
      const content = await rpc.request.readFile({ path: entry.path })
      openFile(entry.path, content)
      close()
    },
    [openFile, close],
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
        if (selected) void selectFile(selected)
      } else if (e.key === "Escape") {
        e.preventDefault()
        close()
      }
    },
    [results, selectedIndex, selectFile, close],
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
    selectFile,
    handleKeyDown,
  }
}
