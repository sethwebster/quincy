import { Bold, Italic, Code, Link, List, ListOrdered, Quote, Heading2, Minus } from "lucide-react"
import type { EditorMode } from "../../../shared/types"

interface ToolbarProps {
  mode: EditorMode
  onAction: (action: ToolbarAction) => void
}

export type ToolbarAction =
  | "bold" | "italic" | "code" | "link"
  | "h2" | "ul" | "ol" | "quote" | "rule"

interface ToolbarItem {
  action: ToolbarAction
  icon: React.ReactNode
  title: string
  modes: EditorMode[]
}

const ITEMS: ToolbarItem[] = [
  { action: "bold",   icon: <Bold size={14} />,         title: "Bold",            modes: ["rich"] },
  { action: "italic", icon: <Italic size={14} />,       title: "Italic",          modes: ["rich"] },
  { action: "h2",     icon: <Heading2 size={14} />,     title: "Heading",         modes: ["rich"] },
  { action: "code",   icon: <Code size={14} />,         title: "Inline code",     modes: ["rich"] },
  { action: "link",   icon: <Link size={14} />,         title: "Link",            modes: ["rich"] },
  { action: "ul",     icon: <List size={14} />,         title: "Bullet list",     modes: ["rich"] },
  { action: "ol",     icon: <ListOrdered size={14} />,  title: "Numbered list",   modes: ["rich"] },
  { action: "quote",  icon: <Quote size={14} />,        title: "Blockquote",      modes: ["rich"] },
  { action: "rule",   icon: <Minus size={14} />,        title: "Divider",         modes: ["rich"] },
]

export function Toolbar({ mode, onAction }: ToolbarProps) {
  const visibleItems = ITEMS.filter((item) => item.modes.includes(mode))

  // In source/split modes the toolbar is minimal — users write syntax directly
  if (visibleItems.length === 0) return null

  return (
    <div
      className="no-drag flex items-center gap-0.5 border-b px-3 py-1"
      style={{ borderColor: "var(--color-glass-border)" }}
    >
      {visibleItems.map((item) => (
        <button
          key={item.action}
          title={item.title}
          onClick={() => onAction(item.action)}
          className="flex h-7 w-7 items-center justify-center rounded-md transition-colors duration-100"
          style={{ color: "var(--color-text-muted)" }}
          onMouseEnter={(e) => {
            ;(e.currentTarget as HTMLButtonElement).style.color = "var(--color-text-primary)"
            ;(e.currentTarget as HTMLButtonElement).style.background = "var(--color-glass-hover)"
          }}
          onMouseLeave={(e) => {
            ;(e.currentTarget as HTMLButtonElement).style.color = "var(--color-text-muted)"
            ;(e.currentTarget as HTMLButtonElement).style.background = "transparent"
          }}
        >
          {item.icon}
        </button>
      ))}
    </div>
  )
}
