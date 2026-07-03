import { ChatMessage } from "quincy"

const base = { id: "m", turnId: "t1" }
// Dark stage — the assistant panel canvas; without it, light markdown text
// renders invisible in isolated capture.
const wrap: React.CSSProperties = { padding: 20, background: "var(--color-surface-0)" }

export const UserMessage = () => (
  <div style={wrap}>
    <ChatMessage
      message={{
        ...base,
        role: "user",
        content: "Can you tighten the intro paragraph and fix the heading levels?",
      }}
    />
  </div>
)

export const AssistantReply = () => (
  <div style={wrap}>
    <ChatMessage
      message={{
        ...base,
        role: "assistant",
        content:
          "Done. I **tightened the intro** to two sentences and normalized the heading levels:\n\n- `H1` — title only\n- `H2` — section starts\n\nWant me to add a table of contents next?",
      }}
    />
  </div>
)

export const WithToolUses = () => (
  <div style={wrap}>
    <ChatMessage
      message={{
        ...base,
        role: "assistant",
        content: "Applied the edits across the document.",
        toolUses: [
          { id: "a", label: "Edit README.md" },
          { id: "b", label: "Read styles.css" },
        ],
      }}
    />
  </div>
)

export const Streaming = () => (
  <div style={wrap}>
    <ChatMessage
      message={{ ...base, role: "assistant", content: "Rewriting the section", streaming: true }}
    />
  </div>
)

export const ErrorState = () => (
  <div style={wrap}>
    <ChatMessage
      message={{
        ...base,
        role: "assistant",
        content: "",
        error: "Model request failed: rate limit exceeded. Retry in 20s.",
      }}
    />
  </div>
)
