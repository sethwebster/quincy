import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { memo, forwardRef } from "react"

interface MarkdownPreviewProps {
  content: string
}

export const MarkdownPreview = memo(forwardRef<HTMLDivElement, MarkdownPreviewProps>(
  function MarkdownPreview({ content }, ref) {
    return (
      <div
        ref={ref}
        className="editor-content h-full overflow-y-auto px-8 py-6"
        style={{ color: "var(--color-text-primary)" }}
      >
        {content.trim() ? (
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
        ) : (
          <p style={{ color: "var(--color-text-placeholder)" }}>Preview will appear here…</p>
        )}
      </div>
    )
  },
))
