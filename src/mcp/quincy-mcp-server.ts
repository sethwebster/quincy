/**
 * Quincy MCP server (stdio).
 *
 * Spawned as a grandchild of the Bun main process by the Claude/Codex CLI. It
 * cannot use Electrobun RPC, so it reaches app state over the loopback HTTP
 * bridge, authenticated with a bearer token. Both are passed via env:
 *   QUINCY_BRIDGE_URL, QUINCY_BRIDGE_TOKEN
 *
 * Tools:
 *   get_document  — returns the open document's markdown + metadata
 *   edit_document — replaces the whole document (live, undoable in the editor)
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { z } from "zod"
import { computeEdit } from "./computeEdit"

const BRIDGE_URL = process.env.QUINCY_BRIDGE_URL ?? ""
const BRIDGE_TOKEN = process.env.QUINCY_BRIDGE_TOKEN ?? ""

function authHeaders(): Record<string, string> {
  return { authorization: `Bearer ${BRIDGE_TOKEN}`, "content-type": "application/json" }
}

interface DocSnapshot {
  docKey: string
  path: string | null
  title: string
  content: string
}

async function fetchDocument(): Promise<DocSnapshot | null> {
  const res = await fetch(`${BRIDGE_URL}/document`, { headers: authHeaders() })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`bridge GET /document failed: ${res.status}`)
  return (await res.json()) as DocSnapshot
}

async function applyEdit(
  content: string,
  docKey: string,
  baseContent: string,
): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(`${BRIDGE_URL}/edit`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ content, docKey, baseContent }),
  })
  const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }
  return { ok: res.ok && body.ok !== false, error: body.error }
}

const server = new McpServer({ name: "quincy", version: "0.1.0" })

server.registerTool(
  "get_document",
  {
    title: "Get document",
    description: "Return the markdown content and metadata of the document open in Quincy.",
    inputSchema: {},
  },
  async () => {
    const doc = await fetchDocument()
    if (!doc) {
      return { content: [{ type: "text", text: "No document is currently open in Quincy." }] }
    }
    const header = `title: ${doc.title}\npath: ${doc.path ?? "untitled"}\n\n`
    return { content: [{ type: "text", text: header + doc.content }] }
  },
)

server.registerTool(
  "edit_document",
  {
    title: "Edit document",
    description:
      "Replace the entire content of the open document. Provide the full new markdown in `content`. " +
      "Optionally pass `find`/`replace` instead to substitute every occurrence of a string. " +
      "The edit is applied live in the editor and is undoable by the user. " +
      "Fails if the user edited the document since it was read — re-read with get_document and retry.",
    inputSchema: {
      content: z.string().optional().describe("Full new markdown content for the document."),
      find: z.string().optional().describe("Substring to replace (used with `replace`)."),
      replace: z.string().optional().describe("Replacement text for `find`."),
    },
  },
  async ({ content, find, replace }) => {
    const doc = await fetchDocument()
    if (!doc) {
      return { isError: true, content: [{ type: "text", text: "No document is open to edit." }] }
    }

    const edit = computeEdit(doc.content, { content, find, replace })
    if (!edit.ok) {
      return { isError: true, content: [{ type: "text", text: edit.error }] }
    }

    const result = await applyEdit(edit.next, doc.docKey, doc.content)
    if (!result.ok) {
      return { isError: true, content: [{ type: "text", text: `Edit failed: ${result.error ?? "unknown error"}` }] }
    }
    return { content: [{ type: "text", text: edit.summary }] }
  },
)

const transport = new StdioServerTransport()
await server.connect(transport)
