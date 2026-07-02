import { useRef, useEffect, useState, useCallback, useMemo } from "react"
import type { EditorMode } from "../../../shared/types"

interface MinimapProps {
  content: string
  editorRef: React.RefObject<HTMLDivElement | null>
  mode: EditorMode
}

type LineType =
  | "h1" | "h2" | "h3" | "heading"
  | "code-fence" | "code-block"
  | "quote" | "list" | "text" | "empty"

interface ParsedLine {
  type: LineType
  indent: number
  textWidth: number // 0–1 fraction of content width
}

function parseLine(line: string, inCode: boolean): [ParsedLine, boolean] {
  if (line.startsWith("```")) {
    return [{ type: "code-fence", indent: 0, textWidth: 0.5 }, !inCode]
  }
  if (inCode) {
    return [{ type: "code-block", indent: 1, textWidth: Math.min(line.length / 80, 1) }, true]
  }
  if (/^# /.test(line))      return [{ type: "h1",      indent: 0, textWidth: 0.85 }, false]
  if (/^## /.test(line))     return [{ type: "h2",      indent: 0, textWidth: 0.75 }, false]
  if (/^### /.test(line))    return [{ type: "h3",      indent: 0, textWidth: 0.65 }, false]
  if (/^#{4,6} /.test(line)) return [{ type: "heading", indent: 0, textWidth: 0.6  }, false]
  if (/^> /.test(line))      return [{ type: "quote", indent: 1, textWidth: Math.min((line.length - 2) / 80, 1) }, false]
  if (/^[-*+] |^\d+\. /.test(line)) return [{ type: "list", indent: 1, textWidth: Math.min((line.length - 2) / 80, 1) }, false]
  if (line.trim() === "")    return [{ type: "empty", indent: 0, textWidth: 0 }, false]
  return [{ type: "text", indent: 0, textWidth: Math.min(line.length / 80, 1) }, false]
}

function parseContent(content: string): ParsedLine[] {
  const result: ParsedLine[] = []
  let inCode = false
  for (const line of content.split("\n")) {
    const [parsed, nextCode] = parseLine(line, inCode)
    inCode = nextCode
    result.push(parsed)
  }
  return result
}

// Canvas can't read CSS variables, so ink is picked per resolved theme.
function isLightTheme(): boolean {
  return document.documentElement.getAttribute("data-theme") === "light"
}

function minimapColors(): Record<LineType, string> {
  const ink = isLightTheme() ? "22,22,28" : "255,255,255"
  return {
    h1:           `rgba(${ink},0.95)`,
    h2:           `rgba(${ink},0.85)`,
    h3:           `rgba(${ink},0.75)`,
    heading:      `rgba(${ink},0.65)`,
    "code-fence": isLightTheme() ? "rgba(4,120,87,0.55)" : "rgba(110,231,183,0.55)",
    "code-block": isLightTheme() ? "rgba(4,120,87,0.38)" : "rgba(110,231,183,0.38)",
    quote:        isLightTheme() ? "rgba(101,83,232,0.55)" : "rgba(148,130,244,0.55)",
    list:         `rgba(${ink},0.45)`,
    text:         `rgba(${ink},0.35)`,
    empty:        "",
  }
}

const LINE_H: Record<LineType, number> = {
  h1: 4, h2: 3, h3: 3, heading: 2,
  "code-fence": 2, "code-block": 2,
  quote: 2, list: 2, text: 2, empty: 3,
}

const MINIMAP_TOP_PADDING = 4
const MINIMAP_LINE_GAP = 1

interface MinimapContentSpan {
  top: number
  height: number
}

function getLineHeight(line: ParsedLine, dpr: number): number {
  return LINE_H[line.type] * dpr
}

function getLineAdvance(line: ParsedLine, dpr: number): number {
  return getLineHeight(line, dpr) + MINIMAP_LINE_GAP * dpr
}

function getMinimapContentSpan(lines: ParsedLine[], ch: number, dpr: number): MinimapContentSpan {
  const top = MINIMAP_TOP_PADDING * dpr
  const renderedHeight = lines.reduce((height, line) => height + getLineAdvance(line, dpr), 0)
  const visibleHeight = Math.max(0, ch - top)
  return { top, height: Math.min(renderedHeight, visibleHeight) }
}

function getIndicatorBounds(contentSpan: MinimapContentSpan, scrollPct: number, viewportPct: number, dpr: number) {
  const minIndicatorH = Math.min(24 * dpr, contentSpan.height)
  const indicatorH = Math.min(contentSpan.height, Math.max(viewportPct * contentSpan.height, minIndicatorH))
  const indicatorTop = contentSpan.top + scrollPct * (contentSpan.height - indicatorH)
  return { top: indicatorTop, height: indicatorH }
}

function drawMinimap(
  canvas: HTMLCanvasElement,
  lines: ParsedLine[],
  scrollPct: number,
  viewportPct: number,
  indicatorActive = false,
) {
  const dpr = window.devicePixelRatio || 1
  const ctx = canvas.getContext("2d")
  if (!ctx) return

  const cw = canvas.width
  const ch = canvas.height

  ctx.clearRect(0, 0, cw, ch)

  const PAD = 8 * dpr
  const contentW = cw - PAD * 2
  const contentSpan = getMinimapContentSpan(lines, ch, dpr)
  let y = contentSpan.top
  const colors = minimapColors()

  for (const line of lines) {
    if (y >= ch) break
    const lh = getLineHeight(line, dpr)

    if (line.type !== "empty" && line.textWidth > 0) {
      ctx.fillStyle = colors[line.type]
      const indent = line.indent * 8 * dpr
      const lineW = line.textWidth * (contentW - indent)
      ctx.fillRect(PAD + indent, y, lineW, lh)
    }

    y += getLineAdvance(line, dpr)
  }

  // Viewport indicator
  const { top: indicatorTop, height: indicatorH } = getIndicatorBounds(contentSpan, scrollPct, viewportPct, dpr)
  const alpha = indicatorActive ? 0.14 : 0.06
  const borderAlpha = indicatorActive ? 0.25 : 0.13

  const indicatorInk = isLightTheme() ? "22,22,28" : "255,255,255"
  ctx.fillStyle = `rgba(${indicatorInk},${alpha})`
  ctx.fillRect(0, indicatorTop, cw, indicatorH)
  ctx.fillStyle = `rgba(${indicatorInk},${borderAlpha})`
  ctx.fillRect(0, indicatorTop, cw, dpr)
  ctx.fillRect(0, indicatorTop + indicatorH - dpr, cw, dpr)
}

// ── Scroll detection ────────────────────────────────────────────────────────

function useEditorScroller(
  containerRef: React.RefObject<HTMLDivElement | null>,
  mode: EditorMode,
) {
  const [scroller, setScroller] = useState<HTMLElement | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    setScroller(null)

    function find(): HTMLElement | null {
      const primarySelector = mode === "rich" ? ".overflow-y-auto" : ".cm-scroller"
      const secondarySelector = mode === "rich" ? ".cm-scroller" : ".overflow-y-auto"
      return (
        (container!.querySelector(primarySelector) as HTMLElement | null) ??
        (container!.querySelector(secondarySelector) as HTMLElement | null)
      )
    }

    const el = find()
    if (el) { setScroller(el); return }

    const obs = new MutationObserver(() => {
      const found = find()
      if (found) { setScroller(found); obs.disconnect() }
    })
    obs.observe(container, { childList: true, subtree: true })
    return () => obs.disconnect()
  }, [containerRef, mode])

  return scroller
}

function useScrollInfo(scroller: HTMLElement | null) {
  const [scrollPct, setScrollPct]   = useState(0)
  const [viewportPct, setViewportPct] = useState(1)

  useEffect(() => {
    if (!scroller) return

    function update() {
      const max = scroller!.scrollHeight - scroller!.clientHeight
      setScrollPct(max > 0 ? scroller!.scrollTop / max : 0)
      setViewportPct(scroller!.clientHeight / (scroller!.scrollHeight || 1))
    }

    update()
    scroller.addEventListener("scroll", update, { passive: true })
    const ro = new ResizeObserver(update)
    ro.observe(scroller)
    return () => {
      scroller.removeEventListener("scroll", update)
      ro.disconnect()
    }
  }, [scroller])

  return { scrollPct, viewportPct }
}

// ── Component ───────────────────────────────────────────────────────────────

export function Minimap({ content, editorRef, mode }: MinimapProps) {
  const containerRef  = useRef<HTMLDivElement>(null)
  const canvasRef     = useRef<HTMLCanvasElement>(null)
  const scroller      = useEditorScroller(editorRef, mode)
  const { scrollPct, viewportPct } = useScrollInfo(scroller)
  const lines = useMemo(() => parseContent(content), [content])

  // Drag state (refs to avoid re-render on every mousemove)
  const isDraggingRef         = useRef(false)
  const dragStartYRef         = useRef(0)
  const dragStartScrollPctRef = useRef(0)
  const [isDragging, setIsDragging] = useState(false)
  const [isHoveringIndicator, setIsHoveringIndicator] = useState(false)

  // Resize canvas + redraw
  useEffect(() => {
    const container = containerRef.current
    const canvas    = canvasRef.current
    if (!container || !canvas) return

    const dpr = window.devicePixelRatio || 1

    function resizeAndDraw() {
      const w = container!.offsetWidth
      const h = container!.offsetHeight
      if (w === 0 || h === 0) return
      canvas!.width  = w * dpr
      canvas!.height = h * dpr
      canvas!.style.width  = `${w}px`
      canvas!.style.height = `${h}px`
      drawMinimap(canvas!, lines, scrollPct, viewportPct, isDragging)
    }

    resizeAndDraw()
    const ro = new ResizeObserver(resizeAndDraw)
    ro.observe(container)
    return () => ro.disconnect()
  }, [lines, scrollPct, viewportPct, isDragging])

  // Document-level drag tracking
  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!isDraggingRef.current || !scroller || !canvasRef.current) return
      const dy = e.clientY - dragStartYRef.current
      const dpr = window.devicePixelRatio || 1
      const contentSpan = getMinimapContentSpan(lines, canvasRef.current.height, dpr)
      if (contentSpan.height === 0) return
      const deltaFraction = (dy * dpr) / contentSpan.height
      const newPct = Math.max(0, Math.min(1, dragStartScrollPctRef.current + deltaFraction))
      const max = scroller.scrollHeight - scroller.clientHeight
      scroller.scrollTop = newPct * max
    }

    function onMouseUp() {
      if (!isDraggingRef.current) return
      isDraggingRef.current = false
      setIsDragging(false)
    }

    document.addEventListener("mousemove", onMouseMove)
    document.addEventListener("mouseup", onMouseUp)
    return () => {
      document.removeEventListener("mousemove", onMouseMove)
      document.removeEventListener("mouseup", onMouseUp)
    }
  }, [scroller, lines])

  const hitTestIndicator = useCallback((clientY: number): boolean => {
    const canvas = canvasRef.current
    if (!canvas) return false
    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    const canvasY = (clientY - rect.top) * dpr
    const contentSpan = getMinimapContentSpan(lines, canvas.height, dpr)
    const { top, height } = getIndicatorBounds(contentSpan, scrollPct, viewportPct, dpr)
    return canvasY >= top && canvasY <= top + height
  }, [lines, scrollPct, viewportPct])

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!scroller || !canvasRef.current) return
    if (hitTestIndicator(e.clientY)) {
      isDraggingRef.current = true
      dragStartYRef.current = e.clientY
      dragStartScrollPctRef.current = scrollPct
      setIsDragging(true)
      e.preventDefault()
    } else {
      // Jump to clicked position
      const rect = canvasRef.current.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      const contentSpan = getMinimapContentSpan(lines, canvasRef.current.height, dpr)
      if (contentSpan.height === 0) return
      const canvasY = (e.clientY - rect.top) * dpr
      const pct = Math.max(0, Math.min(1, (canvasY - contentSpan.top) / contentSpan.height))
      const max  = scroller.scrollHeight - scroller.clientHeight
      scroller.scrollTop = pct * max
    }
  }, [hitTestIndicator, lines, scroller, scrollPct])

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsHoveringIndicator(hitTestIndicator(e.clientY))
  }, [hitTestIndicator])

  const handleMouseLeave = useCallback(() => {
    setIsHoveringIndicator(false)
  }, [])

  const cursor = isDragging
    ? "ns-resize"
    : isHoveringIndicator
      ? "grab"
      : "pointer"

  return (
    <div
      ref={containerRef}
      className="relative shrink-0 select-none"
      style={{
        width: "80px",
        borderLeft: "1px solid var(--color-glass-border)",
        background: "var(--color-glass-bg)",
        cursor,
      }}
    >
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{ display: "block" }}
      />
    </div>
  )
}
