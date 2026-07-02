import { memo } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { Pencil, FileText, AlertCircle } from "lucide-react"
import type { AssistantMessage } from "../../../shared/types"

function ToolChip({ label }: { label: string }) {
  const Icon = /edit/i.test(label) ? Pencil : FileText
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs"
      style={{
        background: "var(--color-glass-hover)",
        color: "var(--color-text-secondary)",
        border: "1px solid var(--color-glass-border)",
      }}
    >
      <Icon size={12} />
      {label}
    </span>
  )
}

export const ChatMessage = memo(function ChatMessage({ message }: { message: AssistantMessage }) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div
          className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm px-3.5 py-2 text-sm"
          style={{ background: "var(--color-accent)", color: "white" }}
        >
          {message.content}
        </div>
      </div>
    )
  }

  const isEmpty = !message.content.trim()
  return (
    <div className="flex flex-col gap-2">
      {(message.toolUses?.length ?? 0) > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {message.toolUses!.map((t) => (
            <ToolChip key={t.id} label={t.label} />
          ))}
        </div>
      )}

      {!isEmpty && (
        <div
          className="assistant-markdown max-w-[92%] text-sm leading-relaxed"
          style={{ color: "var(--color-text-primary)" }}
        >
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
          {message.streaming && <span className="assistant-caret">▋</span>}
        </div>
      )}

      {isEmpty && message.streaming && (
        <div className="flex items-center gap-1.5 text-sm" style={{ color: "var(--color-text-muted)" }}>
          <span className="assistant-dot" />
          <span className="assistant-dot" style={{ animationDelay: "0.15s" }} />
          <span className="assistant-dot" style={{ animationDelay: "0.3s" }} />
        </div>
      )}

      {message.error && (
        <div
          className="flex items-start gap-2 rounded-lg px-3 py-2 text-xs"
          style={{ background: "rgba(248,113,113,0.1)", color: "var(--color-danger)" }}
        >
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <span className="whitespace-pre-wrap">{message.error}</span>
        </div>
      )}
    </div>
  )
})
