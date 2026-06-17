import { useRef, useEffect } from "react"
import { Search, X } from "lucide-react"

interface FindReplacePanelProps {
  query: string
  replacement: string
  currentIndex: number
  matchCount: number
  onQueryChange: (query: string) => void
  onReplacementChange: (replacement: string) => void
  onNext: () => void
  onPrevious: () => void
  onReplace: () => void
  onReplaceAll: () => void
  onClose: () => void
}

function useFocusOnOpen(ref: React.RefObject<HTMLInputElement | null>) {
  useEffect(() => {
    ref.current?.focus()
    ref.current?.select()
  }, [ref])
}

export function FindReplacePanel({
  query,
  replacement,
  currentIndex,
  matchCount,
  onQueryChange,
  onReplacementChange,
  onNext,
  onPrevious,
  onReplace,
  onReplaceAll,
  onClose,
}: FindReplacePanelProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  useFocusOnOpen(inputRef)

  return (
    <div
      className="no-drag absolute right-4 top-3 z-40 flex w-[520px] items-center gap-2 rounded-xl px-3 py-2 shadow-2xl"
      style={{
        background: "rgba(15, 15, 20, 0.96)",
        border: "1px solid var(--color-glass-border)",
        backdropFilter: "blur(18px)",
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose()
        if (event.key === "Enter" && event.shiftKey) onPrevious()
        else if (event.key === "Enter") onNext()
      }}
    >
      <Search size={14} style={{ color: "var(--color-text-muted)", flexShrink: 0 }} />
      <input
        ref={inputRef}
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder="Find"
        className="w-32 bg-transparent text-xs outline-none"
        style={{ color: "var(--color-text-primary)" }}
      />
      <span className="w-14 text-right text-[11px]" style={{ color: "var(--color-text-muted)" }}>
        {matchCount === 0 ? "0/0" : `${currentIndex + 1}/${matchCount}`}
      </span>
      <input
        value={replacement}
        onChange={(event) => onReplacementChange(event.target.value)}
        placeholder="Replace"
        className="w-32 bg-transparent text-xs outline-none"
        style={{ color: "var(--color-text-primary)" }}
      />
      <button className="rounded px-2 py-1 text-[11px]" onClick={onPrevious}>Prev</button>
      <button className="rounded px-2 py-1 text-[11px]" onClick={onNext}>Next</button>
      <button className="rounded px-2 py-1 text-[11px]" onClick={onReplace}>Replace</button>
      <button className="rounded px-2 py-1 text-[11px]" onClick={onReplaceAll}>All</button>
      <button className="rounded p-1" title="Close find" onClick={onClose}>
        <X size={13} />
      </button>
    </div>
  )
}
