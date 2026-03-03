import { useEffect, useRef } from "react"

/**
 * Proportionally syncs scroll position between two containers.
 * When one scrolls, the other matches the same scroll percentage.
 */
export function useSyncedScroll(
  source: HTMLElement | null,
  preview: HTMLElement | null,
) {
  const scrollingRef = useRef<"source" | "preview" | null>(null)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    if (!source || !preview) return

    function scrollPercent(el: HTMLElement): number {
      const max = el.scrollHeight - el.clientHeight
      return max > 0 ? el.scrollTop / max : 0
    }

    function applyPercent(el: HTMLElement, pct: number) {
      const max = el.scrollHeight - el.clientHeight
      el.scrollTop = max * pct
    }

    function handleSourceScroll() {
      if (scrollingRef.current === "preview") return
      scrollingRef.current = "source"
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(() => {
        applyPercent(preview!, scrollPercent(source!))
        rafRef.current = requestAnimationFrame(() => {
          scrollingRef.current = null
        })
      })
    }

    function handlePreviewScroll() {
      if (scrollingRef.current === "source") return
      scrollingRef.current = "preview"
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(() => {
        applyPercent(source!, scrollPercent(preview!))
        rafRef.current = requestAnimationFrame(() => {
          scrollingRef.current = null
        })
      })
    }

    source.addEventListener("scroll", handleSourceScroll, { passive: true })
    preview.addEventListener("scroll", handlePreviewScroll, { passive: true })

    return () => {
      source.removeEventListener("scroll", handleSourceScroll)
      preview.removeEventListener("scroll", handlePreviewScroll)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [source, preview])
}
