import type { AssistantBackend } from "../../shared/types"

/** A single parsed signal from one NDJSON line of CLI stdout. */
export interface ParsedLine {
  textDelta?: string
  toolUse?: { name: string; label: string }
  done?: boolean
  error?: string
}

export interface SpawnPlan {
  cmd: string
  args: string[]
  /** Extra files to write before spawn (temp MCP config), removed after. */
  tempFiles: { path: string; content: string }[]
  /** The full prompt, written to the child's stdin (avoids ARG_MAX limits). */
  stdin: string
}

export interface BuildSpawnOpts {
  prompt: string
  systemPreamble: string
  bridgeUrl: string
  bridgeToken: string
  /** How to launch the Quincy MCP server (app's bun runtime + server path). */
  mcpServerCmd: string
  mcpServerArgs: string[]
  /** Directory for temp files. */
  tmpDir: string
}

export interface Backend {
  id: AssistantBackend
  detect(): boolean
  buildSpawn(opts: BuildSpawnOpts): SpawnPlan
  parseLine(line: string): ParsedLine | null
}

const QUINCY_TOOLS = ["mcp__quincy__get_document", "mcp__quincy__edit_document"]

function labelForTool(name: string): string {
  if (name.endsWith("edit_document")) return "Editing document"
  if (name.endsWith("get_document")) return "Reading document"
  return name.replace(/^mcp__quincy__/, "")
}

function mcpServerEnv(url: string, token: string): Record<string, string> {
  return { QUINCY_BRIDGE_URL: url, QUINCY_BRIDGE_TOKEN: token }
}

type JsonObject = Record<string, unknown>

function asObject(value: unknown): JsonObject | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as JsonObject)
    : null
}

function parseJsonLine(line: string): JsonObject | null {
  try {
    return asObject(JSON.parse(line))
  } catch {
    return null
  }
}

// ─── Claude Code CLI ─────────────────────────────────────────────────────────

export const claudeBackend: Backend = {
  id: "claude",
  detect: () => Bun.which("claude") !== null,
  buildSpawn(opts) {
    const cmd = Bun.which("claude") ?? "claude"
    const mcpConfigPath = `${opts.tmpDir}/quincy-mcp.json`
    const mcpConfig = {
      mcpServers: {
        quincy: {
          command: opts.mcpServerCmd,
          args: opts.mcpServerArgs,
          env: mcpServerEnv(opts.bridgeUrl, opts.bridgeToken),
        },
      },
    }
    const args = [
      "-p",
      "--output-format", "stream-json",
      "--verbose",
      "--include-partial-messages",
      "--mcp-config", mcpConfigPath,
      "--strict-mcp-config",
      "--allowedTools", QUINCY_TOOLS.join(","),
      "--append-system-prompt", opts.systemPreamble,
    ]
    return {
      cmd,
      args,
      tempFiles: [{ path: mcpConfigPath, content: JSON.stringify(mcpConfig, null, 2) }],
      stdin: opts.prompt,
    }
  },
  parseLine(line) {
    const obj = parseJsonLine(line)
    if (!obj) return null
    switch (obj.type) {
      case "stream_event": {
        const ev = asObject(obj.event)
        const delta = asObject(ev?.delta)
        if (ev?.type === "content_block_delta" && delta?.type === "text_delta" && typeof delta.text === "string") {
          return { textDelta: delta.text }
        }
        return null
      }
      case "assistant": {
        const message = asObject(obj.message)
        const blocks = Array.isArray(message?.content) ? message.content : []
        for (const raw of blocks) {
          const block = asObject(raw)
          if (block?.type === "tool_use" && typeof block.name === "string") {
            return { toolUse: { name: block.name, label: labelForTool(block.name) } }
          }
        }
        return null
      }
      case "result": {
        if (typeof obj.subtype === "string" && obj.subtype !== "success") {
          return { done: true, error: String(obj.result ?? obj.subtype) }
        }
        return { done: true }
      }
      default:
        return null
    }
  },
}

// ─── Codex CLI ───────────────────────────────────────────────────────────────
// Flags verified against `codex exec --help` (2026-07-01): `--sandbox
// read-only`, `--json`, `-c key=value` overrides, and `-` for stdin prompt all
// exist. The JSON event shapes in parseLine remain best-effort until exercised
// against a live `codex exec --json` stream.

export const codexBackend: Backend = {
  id: "codex",
  detect: () => Bun.which("codex") !== null,
  buildSpawn(opts) {
    const cmd = Bun.which("codex") ?? "codex"
    // Inject the Quincy MCP server via `-c` config overrides so the user's
    // ~/.codex/config.toml is left untouched. Values are TOML literals.
    const toml = (v: unknown) => JSON.stringify(v)
    const env = mcpServerEnv(opts.bridgeUrl, opts.bridgeToken)
    const args = [
      "exec",
      "--json",
      // Read-only sandbox: the assistant only needs the Quincy MCP tools
      // (spawned by codex itself, outside the sandbox). Never bypass the
      // sandbox — the prompt embeds attacker-controllable document content.
      "--sandbox", "read-only",
      "-c", `mcp_servers.quincy.command=${toml(opts.mcpServerCmd)}`,
      "-c", `mcp_servers.quincy.args=${toml(opts.mcpServerArgs)}`,
      "-c", `mcp_servers.quincy.env.QUINCY_BRIDGE_URL=${toml(env.QUINCY_BRIDGE_URL)}`,
      "-c", `mcp_servers.quincy.env.QUINCY_BRIDGE_TOKEN=${toml(env.QUINCY_BRIDGE_TOKEN)}`,
      "-", // read prompt from stdin
    ]
    return { cmd, args, tempFiles: [], stdin: `${opts.systemPreamble}\n\n${opts.prompt}` }
  },
  parseLine(line) {
    const obj = parseJsonLine(line)
    if (!obj) return null
    const msg = asObject(obj.msg)
    const item = asObject(obj.item)
    const type = typeof obj.type === "string" ? obj.type : typeof msg?.type === "string" ? msg.type : ""

    // Per-item events (item.started / item.completed / item.updated): these
    // fire for EVERY item — reasoning, tool calls, messages — and must never
    // be treated as turn completion. Route them by the item's own type.
    if (/^item[._]/i.test(type)) {
      const itemType = typeof item?.type === "string" ? item.type : ""
      const text = item?.text
      if (/agent_message/i.test(itemType) && typeof text === "string" && /completed/i.test(type)) {
        return { textDelta: text }
      }
      if (/mcp|tool/i.test(itemType)) {
        const name = item?.name ?? item?.tool
        if (typeof name === "string" && name) return { toolUse: { name, label: labelForTool(name) } }
      }
      return null
    }

    // Streaming text deltas.
    const delta = obj.delta ?? msg?.delta
    if (typeof delta === "string" && /agent|message|delta/i.test(type)) {
      return { textDelta: delta }
    }
    const text = obj.text ?? item?.text
    if (/agent_message/i.test(type) && typeof text === "string") {
      return { textDelta: text }
    }
    // Tool / MCP calls.
    if (/mcp|tool/i.test(type)) {
      const name = obj.name ?? item?.name ?? obj.tool
      if (typeof name === "string" && name) return { toolUse: { name, label: labelForTool(name) } }
    }
    // Turn completion / error (item-scoped events were handled above).
    if (/complete|completed|task_finished/i.test(type)) return { done: true }
    if (/error/i.test(type)) return { done: true, error: String(obj.message ?? obj.error ?? "Codex error") }
    return null
  },
}

export const backends: Record<AssistantBackend, Backend> = {
  claude: claudeBackend,
  codex: codexBackend,
}

export function detectBackends(): { claude: boolean; codex: boolean } {
  return { claude: claudeBackend.detect(), codex: codexBackend.detect() }
}
