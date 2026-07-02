import { useRef, useEffect } from "react"
import { motion } from "framer-motion"
import { FileText, Search, Text } from "lucide-react"
import { Glass } from "../components/Glass"
import type { QuickOpenResult } from "./useQuickOpen"

interface QuickOpenModalProps {
  query: string
  onQueryChange: (q: string) => void
  results: QuickOpenResult[]
  selectedIndex: number
  onSelect: (result: QuickOpenResult) => void
  onKeyDown: (e: React.KeyboardEvent) => void
  onClose: () => void
}

function useAutoFocus(ref: React.RefObject<HTMLInputElement | null>) {
  useEffect(() => {
    ref.current?.focus()
  }, [ref])
}

function useScrollIntoView(
  containerRef: React.RefObject<HTMLDivElement | null>,
  selectedIndex: number,
) {
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const item = container.children[selectedIndex] as HTMLElement | undefined
    item?.scrollIntoView({ block: "nearest" })
  }, [containerRef, selectedIndex])
}

function shortenPath(fullPath: string): string {
  const home = fullPath.indexOf("/Users/")
  if (home === -1) return fullPath
  const afterHome = fullPath.substring(home + 7)
  const slash = afterHome.indexOf("/")
  return slash === -1 ? fullPath : "~" + afterHome.substring(slash)
}

export function QuickOpenModal({
  query,
  onQueryChange,
  results,
  selectedIndex,
  onSelect,
  onKeyDown,
  onClose,
}: QuickOpenModalProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)

  useAutoFocus(inputRef)
  useScrollIntoView(listRef, selectedIndex)

  return (
    <motion.div
      className="fixed inset-0 z-50 flex justify-center"
      style={{ paddingTop: "15vh" }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.12 }}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        style={{ background: "rgba(0, 0, 0, 0.4)" }}
        onClick={onClose}
      />

      {/* Panel */}
      <Glass
        elevated
        className="relative flex max-h-[420px] w-[560px] flex-col overflow-hidden rounded-xl"
      >
        {/* Search input */}
        <div
          className="flex items-center gap-3 px-4 py-3"
          style={{ borderBottom: "1px solid var(--color-glass-border)" }}
        >
          <Search size={16} style={{ color: "var(--color-text-muted)", flexShrink: 0 }} />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search files and content..."
            spellCheck={false}
            autoCorrect="off"
            autoCapitalize="off"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            onKeyDown={onKeyDown}
            className="w-full bg-transparent text-sm outline-none"
            style={{ color: "var(--color-text-primary)" }}
          />
        </div>

        {/* Results */}
        <div ref={listRef} className="flex-1 overflow-y-auto py-1">
          {results.length === 0 && (
            <div
              className="px-4 py-6 text-center text-xs"
              style={{ color: "var(--color-text-muted)" }}
            >
              {query ? "No matching files" : "No files found"}
            </div>
          )}
          {results.map((result, i) => (
            <button
              key={result.kind === "content" ? `${result.path}:${result.lineNumber}` : result.path}
              className="flex w-full items-center gap-3 px-4 py-1.5 text-left text-sm transition-colors"
              style={{
                background: i === selectedIndex ? "var(--color-glass-hover)" : "transparent",
                color: "var(--color-text-primary)",
              }}
              onClick={() => onSelect(result)}
              onMouseEnter={() => {
                // Intentionally no-op: keyboard drives selection
              }}
            >
              {result.kind === "file" ? (
                <>
                  <FileText size={13} style={{ color: "var(--color-text-muted)", flexShrink: 0 }} />
                  <span className="truncate font-medium">{result.name}</span>
                  <span className="truncate text-xs" style={{ color: "var(--color-text-muted)" }}>
                    {shortenPath(result.path)}
                  </span>
                </>
              ) : (
                <>
                  <Text size={13} style={{ color: "var(--color-accent)", flexShrink: 0 }} />
                  <span className="min-w-0 flex-1 truncate text-xs" style={{ color: "var(--color-text-secondary)" }}>
                    {result.snippet}
                  </span>
                  <span className="shrink-0 truncate text-xs" style={{ color: "var(--color-text-muted)" }}>
                    {result.name}:{result.lineNumber}
                  </span>
                </>
              )}
            </button>
          ))}
        </div>
      </Glass>
    </motion.div>
  )
}
