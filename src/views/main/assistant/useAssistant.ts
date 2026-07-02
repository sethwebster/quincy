import { useCallback, useEffect, useRef, useState } from "react"
import { useConvexAuth, useMutation, useQuery } from "convex/react"
import { api } from "../../../../convex/_generated/api"
import { rpc } from "../rpc/client"
import { useEditor } from "../editor/EditorContext"
import type { AssistantBackend, AssistantEdit, AssistantMessage } from "../../../shared/types"

interface ChunkEvent { turnId: string; delta: string }
interface ToolUseEvent { turnId: string; toolUseId: string; label: string }
interface DoneEvent { turnId: string }
interface ErrorEvent { turnId: string; message: string }

function useWindowEvent<T>(name: string, handler: (detail: T) => void) {
  const ref = useRef(handler)
  ref.current = handler
  useEffect(() => {
    const listener = (e: Event) => ref.current((e as CustomEvent<T>).detail)
    window.addEventListener(name, listener)
    return () => window.removeEventListener(name, listener)
  }, [name])
}

export interface UseAssistant {
  messages: AssistantMessage[]
  backend: AssistantBackend
  setBackend: (b: AssistantBackend) => void
  available: { claude: boolean; codex: boolean }
  streaming: boolean
  hasDoc: boolean
  send: (question: string) => void
  cancel: () => void
  clear: () => void
}

export function useAssistant(): UseAssistant {
  const { docKey, applyAssistantEdit, getLatestContent } = useEditor()
  // Signed out, the assistant still works — the thread just isn't persisted.
  const { isAuthenticated } = useConvexAuth()
  const persisted = useQuery(api.assistant.listByDocKey, docKey && isAuthenticated ? { docKey } : "skip")
  const append = useMutation(api.assistant.appendMessage)
  const clearThread = useMutation(api.assistant.clearThread)

  const [messages, setMessages] = useState<AssistantMessage[]>([])
  const [backend, setBackend] = useState<AssistantBackend>("claude")
  const [available, setAvailable] = useState({ claude: false, codex: false })
  const [streaming, setStreaming] = useState(false)

  const messagesRef = useRef<AssistantMessage[]>(messages)
  messagesRef.current = messages
  const currentTurnRef = useRef<string | null>(null)
  const loadedDocKeyRef = useRef<string | null>(null)
  // Per-turn bookkeeping kept outside React state: streamed content can lose
  // trailing deltas if read from state in the same batch as the done event,
  // and the persist target must be the docKey the turn STARTED on.
  const turnDocKeyRef = useRef(new Map<string, string>())
  const turnContentRef = useRef(new Map<string, string>())

  // Detect available backends once and pick a sensible default.
  useEffect(() => {
    void rpc.request.assistantBackends({}).then((a) => {
      setAvailable(a)
      setBackend(a.claude ? "claude" : a.codex ? "codex" : "claude")
    })
  }, [])

  // Load persisted thread when the active document changes. A turn still
  // running against the previous document is cancelled — its CLI would
  // otherwise keep streaming (and trying to edit) against the new one.
  const thread = isAuthenticated ? persisted : []
  useEffect(() => {
    if (docKey === loadedDocKeyRef.current) return
    if (thread === undefined) return // still loading for the new docKey
    loadedDocKeyRef.current = docKey
    if (currentTurnRef.current) {
      rpc.send.assistantCancel({ turnId: currentTurnRef.current })
    }
    currentTurnRef.current = null
    setStreaming(false)
    setMessages(
      (thread ?? []).map((p) => ({
        id: p._id,
        turnId: p.turnId,
        role: p.role,
        content: p.content,
      })),
    )
  }, [docKey, thread])

  const patchMessage = useCallback(
    (turnId: string, role: "user" | "assistant", fn: (m: AssistantMessage) => AssistantMessage) => {
      setMessages((prev) => prev.map((m) => (m.turnId === turnId && m.role === role ? fn(m) : m)))
    },
    [],
  )

  useWindowEvent<ChunkEvent>("quincy:assistantChunk", ({ turnId, delta }) => {
    turnContentRef.current.set(turnId, (turnContentRef.current.get(turnId) ?? "") + delta)
    patchMessage(turnId, "assistant", (m) => ({ ...m, content: m.content + delta }))
  })

  useWindowEvent<ToolUseEvent>("quincy:assistantToolUse", ({ turnId, toolUseId, label }) => {
    patchMessage(turnId, "assistant", (m) => ({
      ...m,
      toolUses: [...(m.toolUses ?? []), { id: toolUseId, label }],
    }))
  })

  useWindowEvent<DoneEvent>("quincy:assistantDone", ({ turnId }) => {
    patchMessage(turnId, "assistant", (m) => ({ ...m, streaming: false }))
    if (currentTurnRef.current === turnId) {
      setStreaming(false)
      currentTurnRef.current = null
    }
    const finalContent = turnContentRef.current.get(turnId) ?? ""
    const turnDocKey = turnDocKeyRef.current.get(turnId)
    turnContentRef.current.delete(turnId)
    turnDocKeyRef.current.delete(turnId)
    if (isAuthenticated && turnDocKey && finalContent.trim()) {
      void append({ docKey: turnDocKey, turnId, role: "assistant", content: finalContent })
    }
  })

  useWindowEvent<ErrorEvent>("quincy:assistantError", ({ turnId, message }) => {
    patchMessage(turnId, "assistant", (m) => ({ ...m, streaming: false, error: message }))
    if (currentTurnRef.current === turnId) {
      setStreaming(false)
      currentTurnRef.current = null
    }
    turnContentRef.current.delete(turnId)
    turnDocKeyRef.current.delete(turnId)
  })

  useWindowEvent<AssistantEdit>(
    "quincy:assistantApplyEdit",
    ({ editId, content, docKey: targetDocKey, baseContent }) => {
      // Never mutate a document the edit wasn't computed for: the user may
      // have switched files or typed since the assistant read it.
      if (targetDocKey !== docKey) {
        rpc.send.assistantEditApplied({
          editId,
          ok: false,
          error: "A different document is open now; the edit was not applied.",
        })
        return
      }
      if (baseContent !== getLatestContent()) {
        rpc.send.assistantEditApplied({
          editId,
          ok: false,
          error: "The document changed while the edit was being prepared. Re-read it with get_document and retry.",
        })
        return
      }
      let ok = false
      let error: string | undefined
      try {
        ok = applyAssistantEdit(content)
      } catch (err) {
        error = String(err)
      }
      rpc.send.assistantEditApplied({ editId, ok, error })
    },
  )

  const send = useCallback(
    (question: string) => {
      const trimmed = question.trim()
      if (!trimmed || !docKey || streaming) return
      const turnId = crypto.randomUUID()
      currentTurnRef.current = turnId
      turnDocKeyRef.current.set(turnId, docKey)
      turnContentRef.current.set(turnId, "")

      const history = messagesRef.current
        .filter((m) => m.content.trim())
        .map((m) => ({ role: m.role, content: m.content }))

      const userMsg: AssistantMessage = { id: `${turnId}:u`, turnId, role: "user", content: trimmed }
      const asstMsg: AssistantMessage = {
        id: `${turnId}:a`,
        turnId,
        role: "assistant",
        content: "",
        streaming: true,
        toolUses: [],
      }
      setMessages((prev) => [...prev, userMsg, asstMsg])
      setStreaming(true)
      if (isAuthenticated) void append({ docKey, turnId, role: "user", content: trimmed })
      rpc.send.assistantAsk({ turnId, backend, question: trimmed, history })
    },
    [docKey, streaming, backend, append, isAuthenticated],
  )

  const cancel = useCallback(() => {
    const turnId = currentTurnRef.current
    if (turnId) {
      rpc.send.assistantCancel({ turnId })
      patchMessage(turnId, "assistant", (m) => ({ ...m, streaming: false }))
    }
    currentTurnRef.current = null
    setStreaming(false)
  }, [patchMessage])

  const clear = useCallback(() => {
    setMessages([])
    if (docKey && isAuthenticated) void clearThread({ docKey })
  }, [docKey, clearThread, isAuthenticated])

  return {
    messages,
    backend,
    setBackend,
    available,
    streaming,
    hasDoc: docKey !== null,
    send,
    cancel,
    clear,
  }
}
