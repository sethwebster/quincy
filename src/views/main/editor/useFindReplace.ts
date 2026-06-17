import { useCallback, useEffect, useMemo, useState } from "react"
import type { EditorMode, EditorSelectionRange } from "../../../shared/types"

interface UseFindReplaceOptions {
  content: string
  searchContent?: string
  mode: EditorMode
  selection: EditorSelectionRange | null
  setContent: (content: string) => void
  setSelection: (mode: EditorMode, selection: EditorSelectionRange) => void
  mapMatchToSelection?: (match: EditorSelectionRange) => EditorSelectionRange | null
}

interface MatchRange {
  from: number
  to: number
}

function findMatches(content: string, query: string): MatchRange[] {
  if (!query) return []
  const haystack = content.toLocaleLowerCase()
  const needle = query.toLocaleLowerCase()
  const matches: MatchRange[] = []
  let index = haystack.indexOf(needle)
  while (index !== -1) {
    matches.push({ from: index, to: index + query.length })
    index = haystack.indexOf(needle, index + Math.max(query.length, 1))
  }
  return matches
}

function selectedText(content: string, selection: EditorSelectionRange | null): string {
  if (!selection || selection.from === selection.to) return ""
  const from = Math.max(0, Math.min(selection.from, content.length))
  const to = Math.max(0, Math.min(selection.to, content.length))
  return content.slice(Math.min(from, to), Math.max(from, to))
}

function sameSelection(a: EditorSelectionRange | null, b: EditorSelectionRange | null): boolean {
  return Boolean(a && b && a.from === b.from && a.to === b.to)
}

function nextMatchIndex(matches: MatchRange[], selection: EditorSelectionRange | null): number {
  if (matches.length === 0) return -1
  const cursor = selection ? Math.max(selection.from, selection.to) : 0
  const next = matches.findIndex((match) => match.from >= cursor)
  return next === -1 ? 0 : next
}

function currentMatchIndex(
  matches: MatchRange[],
  selection: EditorSelectionRange | null,
  mapMatchToSelection?: (match: EditorSelectionRange) => EditorSelectionRange | null,
): number {
  if (!selection) return -1
  return matches.findIndex((match) => sameSelection(mapMatchToSelection?.(match) ?? match, selection))
}

export function useFindReplace({
  content,
  searchContent,
  mode,
  selection,
  setContent,
  setSelection,
  mapMatchToSelection,
}: UseFindReplaceOptions) {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [replacement, setReplacement] = useState("")
  const searchableContent = searchContent ?? content
  const matches = useMemo(() => findMatches(searchableContent, query), [searchableContent, query])
  const currentIndex = currentMatchIndex(matches, selection, mapMatchToSelection)

  const selectMatch = useCallback((match: MatchRange | undefined) => {
    if (!match) return
    const selectionRange = mapMatchToSelection?.(match) ?? match
    if (selectionRange) setSelection(mode, selectionRange)
  }, [mapMatchToSelection, mode, setSelection])

  const open = useCallback(() => {
    setIsOpen(true)
    const selected = mapMatchToSelection ? "" : selectedText(searchableContent, selection)
    if (selected) setQuery(selected)
  }, [mapMatchToSelection, searchableContent, selection])

  const close = useCallback(() => setIsOpen(false), [])

  const findNext = useCallback(() => {
    const nextIndex = currentIndex === -1 && !mapMatchToSelection
      ? nextMatchIndex(matches, selection)
      : (currentIndex + 1) % matches.length
    selectMatch(matches[nextIndex])
  }, [currentIndex, mapMatchToSelection, matches, selection, selectMatch])

  const findPrevious = useCallback(() => {
    if (matches.length === 0) return
    if (currentIndex !== -1 || mapMatchToSelection) {
      selectMatch(matches[currentIndex <= 0 ? matches.length - 1 : currentIndex - 1])
      return
    }
    const cursor = selection ? Math.min(selection.from, selection.to) : 0
    const previous = [...matches].reverse().find((match) => match.to <= cursor)
    selectMatch(previous ?? matches[matches.length - 1])
  }, [currentIndex, mapMatchToSelection, matches, selection, selectMatch])

  const replaceCurrent = useCallback(() => {
    const index = currentMatchIndex(matches, selection, mapMatchToSelection)
    const match = matches[index] ?? matches[nextMatchIndex(matches, selection)]
    if (!match) return
    if (mapMatchToSelection) {
      selectMatch(match)
      return
    }
    const nextContent = content.slice(0, match.from) + replacement + content.slice(match.to)
    setContent(nextContent)
    setSelection(mode, { from: match.from, to: match.from + replacement.length })
  }, [content, mapMatchToSelection, matches, mode, replacement, selectMatch, selection, setContent, setSelection])

  const replaceAll = useCallback(() => {
    if (!query || matches.length === 0 || mapMatchToSelection) return
    const nextContent = content.replaceAll(new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), replacement)
    setContent(nextContent)
    setSelection(mode, { from: 0, to: 0 })
  }, [content, matches.length, mode, query, replacement, setContent, setSelection])

  useEffect(() => {
    function handleFind() { open() }
    window.addEventListener("quincy:find", handleFind)
    return () => window.removeEventListener("quincy:find", handleFind)
  }, [open])

  useEffect(() => {
    if (!isOpen || !query || currentIndex !== -1) return
    selectMatch(matches[0])
  }, [currentIndex, isOpen, matches, query, selectMatch])

  return {
    isOpen,
    query,
    replacement,
    currentIndex,
    matchCount: matches.length,
    setQuery,
    setReplacement,
    open,
    close,
    findNext,
    findPrevious,
    replaceCurrent,
    replaceAll,
  }
}
