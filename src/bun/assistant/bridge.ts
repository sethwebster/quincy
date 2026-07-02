import type { AssistantDocSnapshot, AssistantEdit } from "../../shared/types"

/**
 * Loopback HTTP bridge that lets the (grand-child) Quincy MCP server reach app
 * state. The MCP server is spawned by the CLI, so it cannot use Electrobun RPC;
 * it talks to this server over 127.0.0.1 with a per-session bearer token.
 *
 *   GET  /document → cached snapshot of the open doc
 *   POST /edit     → forwards {content} to the renderer via `onApplyEdit`,
 *                    then blocks until the renderer acks (see `resolveEdit`).
 */

const EDIT_TIMEOUT_MS = 20_000

interface PendingEdit {
  resolve: (result: { ok: boolean; error?: string }) => void
  timer: ReturnType<typeof setTimeout>
}

export interface Bridge {
  url: string
  token: string
  /** Update the cached document snapshot (from `syncAssistantDoc`). */
  setSnapshot(snapshot: AssistantDocSnapshot | null): void
  /** Called from the renderer ack (`assistantEditApplied`) to unblock POST /edit. */
  resolveEdit(editId: string, ok: boolean, error?: string): void
  stop(): void
}

export function startBridge(deps: {
  onApplyEdit: (edit: AssistantEdit) => void
}): Bridge {
  const token = crypto.randomUUID()
  let snapshot: AssistantDocSnapshot | null = null
  const pending = new Map<string, PendingEdit>()

  function authed(req: Request): boolean {
    return req.headers.get("authorization") === `Bearer ${token}`
  }

  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0, // OS-assigned random port
    async fetch(req) {
      if (!authed(req)) return new Response("Unauthorized", { status: 401 })
      const url = new URL(req.url)

      if (req.method === "GET" && url.pathname === "/document") {
        if (!snapshot) return new Response("No document open", { status: 404 })
        return Response.json(snapshot)
      }

      if (req.method === "POST" && url.pathname === "/edit") {
        let body: { content?: unknown; docKey?: unknown; baseContent?: unknown }
        try {
          body = await req.json()
        } catch {
          return new Response("Bad JSON", { status: 400 })
        }
        if (
          typeof body.content !== "string" ||
          typeof body.docKey !== "string" ||
          typeof body.baseContent !== "string"
        ) {
          return new Response("Missing content, docKey, or baseContent", { status: 400 })
        }
        // Reject stale edits here too — the renderer re-checks, but failing at
        // the bridge gives the model an actionable error immediately.
        if (!snapshot || snapshot.docKey !== body.docKey) {
          return Response.json(
            { ok: false, error: "The target document is no longer open. Re-read it with get_document." },
            { status: 409 },
          )
        }

        const editId = crypto.randomUUID()
        const result = await new Promise<{ ok: boolean; error?: string }>((resolve) => {
          const timer = setTimeout(() => {
            pending.delete(editId)
            resolve({ ok: false, error: "Timed out waiting for the editor to apply the edit" })
          }, EDIT_TIMEOUT_MS)
          pending.set(editId, { resolve, timer })
          deps.onApplyEdit({
            editId,
            content: body.content as string,
            docKey: body.docKey as string,
            baseContent: body.baseContent as string,
          })
        })

        return Response.json(result, { status: result.ok ? 200 : 500 })
      }

      return new Response("Not found", { status: 404 })
    },
  })

  return {
    url: `http://127.0.0.1:${server.port}`,
    token,
    setSnapshot(next) {
      snapshot = next
    },
    resolveEdit(editId, ok, error) {
      const entry = pending.get(editId)
      if (!entry) return
      clearTimeout(entry.timer)
      pending.delete(editId)
      entry.resolve({ ok, error })
    },
    stop() {
      for (const entry of pending.values()) {
        clearTimeout(entry.timer)
        entry.resolve({ ok: false, error: "Bridge stopped" })
      }
      pending.clear()
      server.stop(true)
    },
  }
}
