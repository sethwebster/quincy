# Assistant Panel & MCP Bridge

## Overview

Quincy's assistant panel lets a user ask questions about the currently open markdown document and ask a local model backend to edit it. The panel lives in the renderer. The model backend runs as a local CLI process started by Bun. The model reads and edits the editor through Quincy's MCP server.

The key constraint is process shape. The CLI starts its MCP server as its own child process, so Quincy's MCP server is a grandchild of the Bun process. It can't use Electrobun RPC directly. Quincy solves that with a small loopback bridge hosted by Bun on `127.0.0.1`, protected by a per-session bearer token.

## Architecture at a glance

| Layer | Code | Responsibility |
| --- | --- | --- |
| Assistant UI | `src/views/main/assistant/AssistantPanel.tsx` | Shows thread, backend toggle, suggestions, composer, stop, clear, and close controls. |
| Assistant state | `src/views/main/assistant/useAssistant.ts` | Detects backends, sends turns, handles stream events, persists messages, and acks applied edits. |
| Editor state | `src/views/main/editor/EditorContext.tsx` | Tracks the open document, syncs snapshots to Bun, and applies assistant edits through the mounted editor. |
| Bun assistant runtime | `src/bun/index.ts`, `src/bun/assistant/backends.ts` | Starts the bridge, detects local CLIs, builds CLI spawn plans, parses streamed CLI output, and routes RPC messages. |
| Loopback bridge | `src/bun/assistant/bridge.ts` | Exposes `GET /document` and `POST /edit` to the MCP server on `127.0.0.1` with bearer auth. |
| MCP server | `src/mcp/quincy-mcp-server.ts` | Registers `get_document` and `edit_document` tools over stdio for the local CLI. |
| Persistence | `convex/assistant.ts`, `convex/schema.ts` | Stores assistant messages by user and document key. |

## End-to-end flow

1. The user opens a document. `EditorContext` derives a document key as `conv:<documentId>` for Convex documents or `file:<absolutePath>` for local files.
2. The renderer debounces document sync and sends `syncAssistantDoc` to Bun with the document key, path, title, content, and current selection.
3. Bun caches that snapshot in the assistant bridge.
4. The user sends a prompt from the assistant panel. `useAssistant` creates a turn id, appends local user and assistant messages, persists the user message, and sends `assistantAsk` with the selected backend and prior non-empty messages as inline history.
5. Bun starts the selected backend CLI with a Quincy MCP server config. The MCP server receives `QUINCY_BRIDGE_URL` and `QUINCY_BRIDGE_TOKEN` in its environment.
6. As the CLI emits JSON lines, Bun parses text deltas, tool calls, completion, and errors. It sends renderer RPC messages such as `assistantChunk`, `assistantToolUse`, `assistantDone`, and `assistantError`.
7. The renderer maps those RPC messages to `quincy:assistant*` window events. `useAssistant` updates the visible assistant message as chunks arrive.
8. When the turn finishes with assistant text, `useAssistant` persists the assistant message in Convex.

Streaming uses fire-and-forget RPC messages rather than long RPC requests. That keeps a multi-second assistant turn outside Electrobun's request timeout.

## Document access

The MCP server exposes `get_document`. When the model calls it, the server sends `GET /document` to the Bun bridge with the bearer token.

The bridge returns the latest cached `AssistantDocSnapshot`:

```json
{
  "docKey": "file:/Users/me/notes.md",
  "path": "/Users/me/notes.md",
  "title": "notes.md",
  "content": "# Notes\n...",
  "selection": { "from": 0, "to": 7 }
}
```

The MCP response formats that as text with a small `title` and `path` header followed by the markdown content. If no document is open, the bridge returns `404` and the tool reports that no document is currently open.

## Editing behavior

The MCP server exposes `edit_document`. It supports two edit forms:

| Input | Behavior |
| --- | --- |
| `content` | Replaces the full open document with the provided markdown. |
| `find` and `replace` | Fetches the current document, replaces the first occurrence of `find`, then submits the full updated content. |

Both forms end at the same bridge endpoint: `POST /edit` with JSON shaped as `{ "content": "..." }`.

The bridge validates JSON, requires `content` to be a string, creates an `editId`, then sends `assistantApplyEdit` to the renderer. The renderer applies the edit and replies with `assistantEditApplied`, including the same `editId`, an `ok` flag, and an optional error. The bridge waits for that ack before returning to the MCP server.

Edit status codes are intentionally simple:

| Condition | Status |
| --- | --- |
| Missing or wrong bearer token | `401` |
| Bad JSON or missing `content` | `400` |
| No document for `GET /document` | `404` |
| Successful edit ack | `200` |
| Failed edit ack or edit timeout | `500` |

The edit timeout is 20 seconds. If the renderer doesn't ack in time, the bridge returns an error to the MCP tool.

## Undo and history

Assistant edits are routed through the mounted editor instead of writing directly to disk. That keeps the user's native undo stack intact.

For source and split mode, CodeMirror receives a normal transaction with `userEvent: "input"`. The implementation computes a shared prefix and suffix so the transaction changes only the differing range. CodeMirror's history extension records it like typed input.

For rich text mode, TipTap receives a normal ProseMirror transaction through `insertContentAt({ from: 0, to: docSize }, markdown)`. The ADR rejects `setContent` for this path because replacing content that way can reset or bypass history.

Expected user behavior: Cmd-Z undoes an assistant edit, and Cmd-Shift-Z redoes it.

## Backend selection

Quincy supports two assistant backend ids: `claude` and `codex`.

Bun detects availability with `Bun.which`. The renderer asks for backend availability once through `assistantBackends`. The panel shows both backend buttons, disables missing backends, and defaults to Claude when found, otherwise Codex when found, otherwise Claude as the inert default.

Claude Code is configured with a temporary MCP config file, strict MCP config, JSON streaming, partial messages, and the two allowed Quincy MCP tools:

```text
mcp__quincy__get_document
mcp__quincy__edit_document
```

Codex support exists in source, but the ADR and source both mark its exact `codex exec` flags and JSON event shapes as unverified on a machine with Codex installed. Treat Codex-specific behavior as a known limitation until verified locally.

## Persistence

Assistant messages are stored in Convex per authenticated user and document key. `convex/assistant.ts` provides:

| Function | Behavior |
| --- | --- |
| `listByDocKey` | Loads messages for the current user and document key in ascending order. |
| `appendMessage` | Inserts a user or assistant message with `docKey`, `turnId`, role, content, and timestamp. |
| `clearThread` | Deletes the current user's messages for one document key. |

`useAssistant` loads the thread when the active document changes. It persists the user message immediately on send. It persists the assistant message only after a completed stream with non-empty content.

Live streaming state is renderer state. If the app closes mid-turn, only messages already written to Convex are guaranteed to exist later.

## Security boundaries

The bridge is local only. It binds to `127.0.0.1` on an OS-assigned port and requires `Authorization: Bearer <token>` on every request.

The bridge URL and token are passed only to the MCP server through the CLI's MCP server environment. Requests without the exact bearer token get `401`.

The MCP server doesn't get broad app RPC access. Its public surface is limited to `get_document` and `edit_document`, and those tools can only operate on the open document snapshot managed by Quincy.

The model backend can still propose arbitrary document content. Quincy protects the application boundary, not the semantics of the text the model writes. Review model edits like any other assistant edit.

## Operational notes

Use these facts when maintaining the system:

| Area | Note |
| --- | --- |
| MCP server path | Development runs the TypeScript MCP server from `src/mcp/quincy-mcp-server.ts`. Builds copy it into app resources. |
| Bridge lifecycle | Bun starts the bridge during app startup and stops it with `server.stop(true)`. Stopping resolves pending edits with an error. |
| Snapshot freshness | Renderer sync is debounced. Very recent keystrokes may take a short moment to appear in `get_document`. |
| Tool labels | Tool events are shown as `Reading document` and `Editing document` for the Quincy tools. |
| Cancellation | The panel sends `assistantCancel` for the current turn and marks the local assistant message as no longer streaming. |
| Clearing | Clear removes local messages and calls `clearThread` for the active document key. |

## Known limitations

Codex behavior needs local verification. Source comments and ADR notes say Codex is not installed in the development environment used for the implementation, so its `codex exec` flags and JSON event parsing are best effort.

`edit_document` is document-level. Even the `find` and `replace` form computes a full next document and posts full content to the bridge.

`find` and `replace` changes only the first occurrence of the `find` text.

The bridge serves only the currently open document. It doesn't expose project search, multiple open files, filesystem browsing, or other app state.

If the editor doesn't ack an edit within 20 seconds, the MCP tool sees an edit failure.

Streaming content that hasn't completed may not be persisted.

## Extending the system

Keep extensions narrow and explicit:

1. Add or change shared RPC types in `src/shared/types.ts` first.
2. Keep model-facing capabilities in `src/mcp/quincy-mcp-server.ts` small and named after user actions.
3. If a new MCP tool needs app state, expose the smallest bridge endpoint that can serve it.
4. Keep bridge endpoints token-gated and loopback-only.
5. Route editor mutations through the mounted editor handle so undo and redo keep working.
6. Add backend-specific parsing in `src/bun/assistant/backends.ts`, and verify it against the real CLI on a machine where that backend is installed.
7. Persist only durable user-visible messages in Convex. Keep transient stream state in the renderer unless there is a product reason to resume it.

## Debugging checklist

Start with the failing boundary:

| Symptom | Check |
| --- | --- |
| Backend button is disabled | Confirm the CLI is on `PATH`; backend detection uses `Bun.which`. |
| Assistant says no document is open | Confirm `docKey` is set and `syncAssistantDoc` is reaching Bun. |
| `get_document` fails | Check `QUINCY_BRIDGE_URL`, `QUINCY_BRIDGE_TOKEN`, bridge auth, and whether the bridge has a snapshot. |
| Edit tool returns `find` not found | Confirm the model used exact current text from `get_document`; only the first exact match is replaced. |
| Edit times out | Check that the renderer received `assistantApplyEdit` and replied with `assistantEditApplied`. |
| Cmd-Z doesn't undo the edit | Confirm the active editor registered its handle and that the edit flowed through `applyAssistantEdit`, not a direct state or disk write. |
| Assistant stream stops early | Check parsed CLI JSON lines and `assistantError` events. |
| Thread doesn't persist | Confirm the user is authenticated in Convex and that `appendMessage` ran for completed turns. |
| Codex output looks wrong | Treat this as expected until the exact Codex flags and JSON events are verified on a machine with Codex installed. |

## See also

- `adr/0001-ai-assistant-panel-and-mcp-bridge.md`
- `src/views/main/assistant/AssistantPanel.tsx`
- `src/views/main/assistant/useAssistant.ts`
- `src/views/main/editor/EditorContext.tsx`
- `src/bun/assistant/bridge.ts`
- `src/bun/assistant/backends.ts`
- `src/mcp/quincy-mcp-server.ts`
- `src/shared/types.ts`
- `convex/assistant.ts`
- `convex/schema.ts`
