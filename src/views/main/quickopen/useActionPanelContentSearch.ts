import { useEffect, useRef, useState } from "react"
import type { ContentSearchResult } from "../../../shared/types"
import { reportAppError } from "../errors"
import { rpc } from "../rpc/client"

const CONTENT_SEARCH_MIN_CHARS = 3
const CONTENT_SEARCH_DEBOUNCE_MS = 150

export interface ContentMatchRange {
  readonly from: number
  readonly to: number
}

export function useActionPanelContentSearch(
  isActive: boolean,
  query: string,
  folders: string[],
): readonly ContentSearchResult[] {
  const [matches, setMatches] = useState<ContentSearchResult[]>([])
  const requestRef = useRef(0)

  useEffect(() => {
    const searchQuery = query.trim()
    if (!isActive || searchQuery.length < CONTENT_SEARCH_MIN_CHARS || folders.length === 0) {
      requestRef.current += 1
      setMatches([])
      return
    }

    const request = requestRef.current + 1
    requestRef.current = request
    const timer = setTimeout(() => {
      rpc.request
        .searchContent({ roots: folders, query: searchQuery })
        .then((found) => {
          if (requestRef.current === request) setMatches(found)
        })
        .catch((error) => {
          if (requestRef.current === request) reportAppError("Content search failed", error)
        })
    }, CONTENT_SEARCH_DEBOUNCE_MS)

    return () => clearTimeout(timer)
  }, [isActive, query, folders])

  return matches
}

export function findContentMatchRange(content: string, lineNumber: number, query: string): ContentMatchRange | null {
  const lines = content.split("\n")
  const line = lines[lineNumber - 1]
  if (line === undefined) return null

  let offset = 0
  for (let i = 0; i < lineNumber - 1; i += 1) offset += (lines[i] ?? "").length + 1

  const index = line.toLowerCase().indexOf(query.toLowerCase())
  const from = offset + Math.max(0, index)
  return { from, to: index === -1 ? from : from + query.length }
}
