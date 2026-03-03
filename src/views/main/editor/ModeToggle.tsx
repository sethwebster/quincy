import { motion } from "framer-motion"
import type { EditorMode } from "../../../shared/types"

interface ModeOption {
  id: EditorMode
  label: string
  title: string
}

const MODES: ModeOption[] = [
  { id: "rich", label: "Rich", title: "Rich text — no markdown syntax" },
  { id: "split", label: "Split", title: "Source and preview side by side" },
  { id: "source", label: "Source", title: "Markdown source with helpers" },
]

interface ModeToggleProps {
  mode: EditorMode
  onChange: (mode: EditorMode) => void
}

export function ModeToggle({ mode, onChange }: ModeToggleProps) {
  return (
    <div
      className="no-drag relative flex items-center rounded-lg p-0.5"
      style={{ background: "rgba(0,0,0,0.3)", border: "1px solid var(--color-glass-border)" }}
    >
      {MODES.map((m) => (
        <button
          key={m.id}
          title={m.title}
          onClick={() => onChange(m.id)}
          className="relative z-10 rounded-md px-3 py-1 text-xs font-medium transition-colors duration-150"
          style={{
            color: mode === m.id ? "var(--color-text-primary)" : "var(--color-text-muted)",
          }}
        >
          {mode === m.id && (
            <motion.div
              layoutId="mode-pill"
              className="absolute inset-0 rounded-md"
              style={{ background: "var(--color-accent)", opacity: 0.9 }}
              transition={{ type: "spring", stiffness: 500, damping: 40 }}
            />
          )}
          <span className="relative">{m.label}</span>
        </button>
      ))}
    </div>
  )
}
