# 0001 — AI assistant panel & MCP bridge

- **Status:** Accepted
- **Date:** 2026-07-01

## Context

Quincy is an Electrobun app: a Bun main process and a WebView renderer that
communicate over a typed Electrobun RPC channel (`AppRPC` in
`src/shared/types.ts`). We want a right-side chat panel where the user asks
questions about the open markdown document. Each question spawns the local
**Claude Code** or **Codex** CLI as a child process and streams the reply back.
The model must also be able to **read and edit** the open document, and those
edits must be **live** in the editor and **undoable with Cmd-Z / Cmd-Shift-Z**.

Two forces shaped the design:

1. The CLI spawns its MCP servers itself, so a Quincy MCP server is a
   **grandchild** of the Bun process. It has no access to the Electrobun RPC
   channel (which only connects the Bun process and the WebView).
2. A turn streams for many seconds, but the Bun-side RPC caps individual
   requests at `maxRequestTime: 10000` (`src/bun/index.ts`).

## Decisions

### 1. Grandchild IPC via a loopback HTTP bridge

The Bun process hosts a loopback `Bun.serve` on `127.0.0.1` with an
OS-assigned port and a per-session bearer token (`src/bun/assistant/bridge.ts`).
The MCP server (`src/mcp/quincy-mcp-server.ts`) receives `QUINCY_BRIDGE_URL` and
`QUINCY_BRIDGE_TOKEN` via its environment and calls:

- `GET /document` → the cached snapshot of the open doc (kept fresh by the
  renderer's debounced `syncAssistantDoc`).
- `POST /edit` → forwards `{content}` to the renderer via
  `rpc.send.assistantApplyEdit`, then blocks until the renderer acks
  (`assistantEditApplied`), correlated by a generated `editId`.

**Alternatives rejected**

- *Disk-write edits* (model writes the file; app watches for changes): loses the
  in-editor undo stack, races with autosave, and can't target the unsaved
  in-memory buffer. Rejected.
- *MCP SDK in-process* (run the MCP server inside the Bun process): impossible —
  the CLI, not Quincy, spawns MCP servers, and it does so as its own child.
  Rejected.

### 2. Streaming over RPC *messages*, not requests

`assistantAsk` / `assistantChunk` / `assistantToolUse` / `assistantDone` /
`assistantError` are fire-and-forget RPC **messages**, mirroring the existing
`updater.ts` streaming pattern, so a multi-second turn isn't bound by
`maxRequestTime`. The renderer re-dispatches each as a `quincy:assistant*` window
event (`src/views/main/rpc/client.ts`), consumed by `useAssistant`.

### 3. Live edits through the editor's native history

Only one editor is mounted at a time (`AnimatePresence mode="wait"`). The mounted
editor registers an imperative handle via `EditorContext.registerEditorHandle`;
`applyAssistantEdit` dispatches the edit *through* that handle so it lands in the
same undo history as manual typing:

- **CodeMirror** (`SourceEditor`, also used by `SplitEditor`): a common
  prefix/suffix diff dispatched as `view.dispatch({changes, userEvent:"input"})`,
  recorded by the default `history`/`historyKeymap`.
- **TipTap** (`RichTextEditor`): `insertContentAt({from:0,to:docSize}, markdown)`
  — a normal ProseMirror transaction added to StarterKit's history. `setContent`
  was rejected because it can reset/replace history and is unreliable as a single
  undoable step.

### 4. Multi-turn via inline transcript

Prior turns are re-sent inline in each prompt (backend-agnostic) rather than
relying on CLI session-resume, which differs between Claude and Codex.

### 5. Chat persisted per-document in Convex

A new `assistantMessages` table (`convex/schema.ts`, `convex/assistant.ts`) keyed
by `docKey` (`conv:<documentId>` or `file:<absolutePath>`) persists turns so a
document's conversation survives restarts. Live streaming stays in renderer
state; the user turn is persisted on send and the assistant turn on completion.

## Consequences

- The bridge is loopback-only and token-gated; requests without the token get
  `401`.
- Backends are auto-detected via `Bun.which` and switchable in the panel header.
- The MCP server is bundled into `Resources/app/mcp` at build time
  (`scripts/postbuild.ts`) and run from TS source in dev; both launch it with
  `process.execPath run <path>`.
- Codex's exact `codex exec` flags and JSON event shapes still need verification
  on a machine where Codex is installed (it is absent from the dev container).
