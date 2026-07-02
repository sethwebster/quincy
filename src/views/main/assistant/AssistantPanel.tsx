import { useEffect, useRef, useState } from "react"
import { EtherealInput } from "@sethwebster/react-ethereal-input"
import { ArrowUp, Square, X, Trash2 } from "lucide-react"
import type { UseAssistant } from "./useAssistant"
import { ChatMessage } from "./ChatMessage"
import type { AssistantBackend } from "../../../shared/types"

const SUGGESTIONS = [
  "Summarize this document",
  "Rewrite the first paragraph to be punchier",
  "Fix grammar and spelling",
  "Suggest a better title",
]

const BACKEND_LABELS: Record<AssistantBackend, string> = { claude: "Claude", codex: "Codex" }

function BackendToggle({
  backend,
  setBackend,
  available,
}: {
  backend: AssistantBackend
  setBackend: (b: AssistantBackend) => void
  available: { claude: boolean; codex: boolean }
}) {
  return (
    <div
      className="flex items-center rounded-lg p-0.5"
      style={{ background: "var(--color-glass-hover)", border: "1px solid var(--color-glass-border)" }}
    >
      {(["claude", "codex"] as AssistantBackend[]).map((b) => {
        const enabled = available[b]
        const active = backend === b
        return (
          <button
            key={b}
            disabled={!enabled}
            onClick={() => enabled && setBackend(b)}
            title={enabled ? `Use ${BACKEND_LABELS[b]}` : `${BACKEND_LABELS[b]} not found on PATH`}
            className="no-drag cursor-default rounded-md px-2.5 py-1 text-xs font-medium transition-all"
            style={{
              background: active ? "var(--color-accent)" : "transparent",
              color: active ? "white" : "var(--color-text-secondary)",
              opacity: enabled ? 1 : 0.4,
            }}
          >
            {BACKEND_LABELS[b]}
          </button>
        )
      })}
    </div>
  )
}

// The assistant state lives in MainApp (useAssistant there), NOT here: this
// panel unmounts when hidden, and the RPC event listeners — including the
// edit-apply ack the bridge blocks on — must survive that.
export function AssistantPanel({ onClose, assistant }: { onClose: () => void; assistant: UseAssistant }) {
  const { messages, backend, setBackend, available, streaming, hasDoc, send, cancel, clear } = assistant
  const [input, setInput] = useState("")
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
  }, [messages])

  const canSend = hasDoc && !streaming && input.trim().length > 0

  function submit() {
    if (!canSend) return
    send(input)
    setInput("")
  }

  return (
    <div
      className="glass flex h-full flex-col"
      style={{ borderLeft: "1px solid var(--color-glass-border)" }}
    >
      {/* Header */}
      <div
        className="flex h-11 shrink-0 items-center justify-between px-3"
        style={{ borderBottom: "1px solid var(--color-glass-border)" }}
      >
        <span className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
          Assistant
        </span>
        <div className="flex items-center gap-2">
          <BackendToggle backend={backend} setBackend={setBackend} available={available} />
          {messages.length > 0 && (
            <button
              onClick={clear}
              title="Clear conversation"
              className="no-drag cursor-default rounded-md p-1.5 transition-colors hover:bg-[--color-glass-hover]"
              style={{ color: "var(--color-text-muted)" }}
            >
              <Trash2 size={15} />
            </button>
          )}
          <button
            onClick={onClose}
            title="Close (Cmd+J)"
            className="no-drag cursor-default rounded-md p-1.5 transition-colors hover:bg-[--color-glass-hover]"
            style={{ color: "var(--color-text-muted)" }}
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Message list */}
      <div ref={scrollRef} className="no-drag flex-1 space-y-4 overflow-y-auto px-3.5 py-4">
        {!hasDoc ? (
          <div className="flex h-full items-center justify-center text-center">
            <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
              Open a document to ask questions about it.
            </p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col justify-center gap-2">
            <p className="mb-1 text-center text-sm" style={{ color: "var(--color-text-muted)" }}>
              Ask anything about this document
            </p>
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                disabled={streaming}
                className="no-drag cursor-default rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-[--color-glass-hover] disabled:opacity-50"
                style={{ border: "1px solid var(--color-glass-border)", color: "var(--color-text-secondary)" }}
              >
                {s}
              </button>
            ))}
          </div>
        ) : (
          messages.map((m) => <ChatMessage key={m.id} message={m} />)
        )}
      </div>

      {/* Composer */}
      <div className="no-drag shrink-0 p-3">
        <EtherealInput
          as="textarea"
          className="no-drag assistant-composer"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault()
              submit()
            }
          }}
          placeholder={hasDoc ? "Ask a question…" : "Open a document first"}
          disabled={!hasDoc}
          autoExpand
          maxAutoExpandHeight={160}
          rows={1}
          containerStyle={{
            background: "var(--color-surface-1)",
            border: "1px solid var(--color-glass-border)",
            color: "var(--color-text-primary)",
          }}
          inputStyle={{
            background: "transparent",
            color: "var(--color-text-primary)",
            caretColor: "var(--color-accent)",
            WebkitTextFillColor: "var(--color-text-primary)",
          }}
          rightContent={
            streaming ? (
              <button
                onClick={cancel}
                title="Stop"
                className="no-drag flex h-8 w-8 cursor-default items-center justify-center rounded-full transition-colors"
                style={{ background: "var(--color-danger)", color: "white" }}
              >
                <Square size={13} fill="currentColor" />
              </button>
            ) : (
              <button
                onClick={submit}
                disabled={!canSend}
                title="Send (Enter)"
                className="no-drag flex h-8 w-8 cursor-default items-center justify-center rounded-full transition-all disabled:opacity-30"
                style={{ background: "var(--color-accent)", color: "white" }}
              >
                <ArrowUp size={16} />
              </button>
            )
          }
        />
      </div>
    </div>
  )
}
