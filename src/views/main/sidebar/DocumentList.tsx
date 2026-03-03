import { useQuery, useMutation } from "convex/react"
import { api } from "../../../../convex/_generated/api"
import type { Id, Doc } from "../../../../convex/_generated/dataModel"
import { motion, AnimatePresence } from "framer-motion"
import { FileText, Trash2 } from "lucide-react"
import { useState } from "react"

interface DocumentListProps {
  activeId: string | null
  onSelect: (id: string) => void
}

export function DocumentList({ activeId, onSelect }: DocumentListProps) {
  const docs: Doc<"documents">[] = useQuery(api.documents.list) ?? []
  const remove = useMutation(api.documents.remove)
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  return (
    <div className="flex flex-col gap-0.5 px-2 py-1">
      <AnimatePresence initial={false}>
        {docs.map((doc) => (
          <motion.div
            key={doc._id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
            transition={{ duration: 0.15 }}
          >
            <button
              className="no-drag group relative flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-colors duration-100"
              style={{
                background: activeId === doc._id ? "var(--color-accent-dim)" : "transparent",
                color: activeId === doc._id ? "var(--color-text-primary)" : "var(--color-text-secondary)",
              }}
              onClick={() => onSelect(doc._id)}
              onMouseEnter={() => setHoveredId(doc._id)}
              onMouseLeave={() => setHoveredId(null)}
              onMouseOver={(e) => {
                if (activeId !== doc._id) {
                  ;(e.currentTarget as HTMLButtonElement).style.background = "var(--color-glass-hover)"
                }
              }}
              onMouseOut={(e) => {
                if (activeId !== doc._id) {
                  ;(e.currentTarget as HTMLButtonElement).style.background = "transparent"
                }
              }}
            >
              <FileText
                size={13}
                style={{
                  color: activeId === doc._id ? "var(--color-accent)" : "var(--color-text-muted)",
                  flexShrink: 0,
                }}
              />
              <span className="flex-1 truncate text-xs font-medium">{doc.title || "Untitled"}</span>

              {hoveredId === doc._id && (
                <button
                  className="no-drag flex h-5 w-5 items-center justify-center rounded opacity-0 transition-opacity group-hover:opacity-100"
                  title="Delete"
                  onClick={(e) => {
                    e.stopPropagation()
                    remove({ id: doc._id as Id<"documents"> })
                    if (activeId === doc._id) onSelect("")
                  }}
                  onMouseEnter={(e) =>
                    ((e.currentTarget as HTMLButtonElement).style.color = "var(--color-danger)")
                  }
                  onMouseLeave={(e) =>
                    ((e.currentTarget as HTMLButtonElement).style.color = "var(--color-text-muted)")
                  }
                  style={{ color: "var(--color-text-muted)" }}
                >
                  <Trash2 size={11} />
                </button>
              )}
            </button>
          </motion.div>
        ))}
      </AnimatePresence>

      {docs.length === 0 && (
        <p className="px-3 py-4 text-center text-xs" style={{ color: "var(--color-text-muted)" }}>
          No documents yet
        </p>
      )}
    </div>
  )
}
