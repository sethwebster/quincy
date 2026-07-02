import { useCallback, useDeferredValue, useEffect, useState, useRef } from "react"
import { SourceEditor } from "./SourceEditor"
import { MarkdownPreview } from "./MarkdownPreview"
import { useSyncedScroll } from "./useSyncedScroll"
import type { EditorSelectionRange } from "../../../shared/types"
import type { MarkdownAttachmentResolver } from "./markdownAttachmentHelpers"

interface SplitEditorProps {
  readonly content: string
  readonly activeFilePath?: string | null
  readonly onChange: (value: string) => void
  readonly selection?: EditorSelectionRange | null
  readonly onSelectionChange?: (selection: EditorSelectionRange) => void
  readonly onResolveAttachments?: MarkdownAttachmentResolver
}

function useCodeMirrorScroller(containerRef: React.RefObject<HTMLDivElement | null>) {
  const [scroller, setScroller] = useState<HTMLElement | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const found = container.querySelector(".cm-scroller") as HTMLElement | null
    if (found) {
      setScroller(found)
      return
    }

    const observer = new MutationObserver(() => {
      const el = container.querySelector(".cm-scroller") as HTMLElement | null
      if (el) {
        setScroller(el)
        observer.disconnect()
      }
    })
    observer.observe(container, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [containerRef])

  return scroller
}

function useCallbackRef() {
  const [el, setEl] = useState<HTMLDivElement | null>(null)
  const ref = useCallback((node: HTMLDivElement | null) => setEl(node), [])
  return [ref, el] as const
}

export function SplitEditor({ content, activeFilePath, onChange, selection, onSelectionChange, onResolveAttachments }: SplitEditorProps) {
  const deferredContent = useDeferredValue(content)
  const handleChange = useCallback((value: string) => onChange(value), [onChange])

  const sourceContainerRef = useRef<HTMLDivElement>(null)
  const [previewRef, previewEl] = useCallbackRef()
  const sourceScroller = useCodeMirrorScroller(sourceContainerRef)

  useSyncedScroll(sourceScroller, previewEl)

  return (
    <div className="flex h-full min-h-0">
      {/* Source pane */}
      <div
        ref={sourceContainerRef}
        className="flex-1 overflow-hidden border-r"
        style={{ borderColor: "var(--color-glass-border)" }}
      >
        <SourceEditor
          content={content}
          onChange={handleChange}
          selection={selection}
          onSelectionChange={onSelectionChange}
          onResolveAttachments={onResolveAttachments}
        />
      </div>

      {/* Preview pane */}
      <div className="flex-1 overflow-hidden">
        <MarkdownPreview ref={previewRef} content={deferredContent} activeFilePath={activeFilePath} />
      </div>
    </div>
  )
}
