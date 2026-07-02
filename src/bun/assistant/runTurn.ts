import type { AssistantBackend, AssistantDocSnapshot, AssistantHistoryTurn } from "../../shared/types"
import { assistantCliEnv, backends } from "./backends"
import { mkdir, rm } from "node:fs/promises"

const SYSTEM_PREAMBLE = [
  "You are running inside Quincy, a local-first markdown editor where the open document is the main interface.",
  "The user is viewing and editing the open document in Quincy while chatting with you from Quincy's Assistant panel.",
  "Answer questions using the currently-open document shown in the prompt, plus the conversation history when relevant.",
  "You have access to the `quincy` MCP server with `get_document` for reading the latest editor contents and `edit_document` for applying edits.",
  "If the user asks you to change the document, edit it ONLY through `quincy.edit_document`; never paste the full rewritten document back into chat.",
  "Use `quincy.get_document` before editing when you need the latest content. Keep chat replies concise and friendly.",
].join(" ")

export interface RunTurnEmit {
  chunk: (turnId: string, delta: string) => void
  toolUse: (turnId: string, label: string) => void
  done: (turnId: string) => void
  error: (turnId: string, message: string) => void
}

export interface RunTurnDeps {
  getSnapshot: () => AssistantDocSnapshot | null
  bridgeUrl: string
  bridgeToken: string
  mcpServerCmd: string
  mcpServerArgs: string[]
  tmpDir: string
  emit: RunTurnEmit
}

export interface RunTurnRequest {
  turnId: string
  backend: AssistantBackend
  question: string
  history: AssistantHistoryTurn[]
}

interface ActiveTurn {
  proc: Bun.Subprocess
  cancelled: boolean
}

const active = new Map<string, ActiveTurn>()

function buildPrompt(question: string, history: AssistantHistoryTurn[], snap: AssistantDocSnapshot | null): string {
  const doc = snap
    ? `<document title=${JSON.stringify(snap.title)} path=${JSON.stringify(snap.path ?? "untitled")}>\n${snap.content}\n</document>`
    : "(no document is currently open)"
  const transcript = history
    .map((t) => `${t.role === "user" ? "User" : "Assistant"}: ${t.content}`)
    .join("\n\n")
  return [
    "# Open document",
    doc,
    transcript ? `# Conversation so far\n${transcript}` : "",
    "# Question",
    question,
  ]
    .filter(Boolean)
    .join("\n\n")
}

export async function runTurn(req: RunTurnRequest, deps: RunTurnDeps): Promise<void> {
  const backend = backends[req.backend]
  if (!backend || !backend.detect()) {
    deps.emit.error(req.turnId, `Backend "${req.backend}" is not available on this machine.`)
    return
  }

  const prompt = buildPrompt(req.question, req.history, deps.getSnapshot())
  const plan = backend.buildSpawn({
    prompt,
    systemPreamble: SYSTEM_PREAMBLE,
    bridgeUrl: deps.bridgeUrl,
    bridgeToken: deps.bridgeToken,
    mcpServerCmd: deps.mcpServerCmd,
    mcpServerArgs: deps.mcpServerArgs,
    tmpDir: deps.tmpDir,
  })

  await mkdir(deps.tmpDir, { recursive: true })
  for (const file of plan.tempFiles) await Bun.write(file.path, file.content)

  let finished = false
  const cleanup = async () => {
    active.delete(req.turnId)
    await Promise.all(
      plan.tempFiles.map((f) => rm(f.path, { force: true }).catch(() => {})),
    )
  }

  let proc: Bun.Subprocess
  try {
    proc = Bun.spawn([plan.cmd, ...plan.args], {
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe",
      env: assistantCliEnv(),
    })
  } catch (err) {
    deps.emit.error(req.turnId, `Failed to launch ${plan.cmd}: ${String(err)}`)
    await cleanup()
    return
  }

  const turn: ActiveTurn = { proc, cancelled: false }
  active.set(req.turnId, turn)

  // Feed the prompt via stdin (avoids ARG_MAX limits on large documents).
  try {
    const stdin = proc.stdin as unknown as { write: (s: string) => void; end: () => void }
    stdin.write(plan.stdin)
    stdin.end()
  } catch {
    // stdin may already be closed if the process died instantly.
  }

  // Drain stderr in the background for error reporting.
  let stderrText = ""
  const stderrDone = (async () => {
    const decoder = new TextDecoder()
    for await (const chunk of proc.stderr as unknown as AsyncIterable<Uint8Array>) {
      stderrText += decoder.decode(chunk, { stream: true })
    }
  })()

  const handleLine = (line: string) => {
    const parsed = backend.parseLine(line)
    if (!parsed) return
    if (parsed.textDelta) deps.emit.chunk(req.turnId, parsed.textDelta)
    if (parsed.toolUse) deps.emit.toolUse(req.turnId, parsed.toolUse.label)
    if (parsed.error) {
      finished = true
      deps.emit.error(req.turnId, parsed.error)
    } else if (parsed.done) {
      finished = true
      deps.emit.done(req.turnId)
    }
  }

  try {
    const decoder = new TextDecoder()
    let buf = ""
    for await (const chunk of proc.stdout as unknown as AsyncIterable<Uint8Array>) {
      buf += decoder.decode(chunk, { stream: true })
      let idx = buf.indexOf("\n")
      while (idx >= 0) {
        const line = buf.slice(0, idx).trim()
        buf = buf.slice(idx + 1)
        if (line) handleLine(line)
        idx = buf.indexOf("\n")
      }
    }
    const tail = buf.trim()
    if (tail) handleLine(tail)
  } catch (err) {
    if (!finished) {
      finished = true
      deps.emit.error(req.turnId, `Stream error: ${String(err)}`)
    }
  }

  const exitCode = await proc.exited
  await stderrDone.catch(() => {})

  // A user-cancelled turn was killed on purpose — the renderer already
  // finalized it, so don't surface the non-zero exit as an error.
  if (!finished && !turn.cancelled) {
    if (exitCode === 0) {
      deps.emit.done(req.turnId)
    } else {
      deps.emit.error(req.turnId, stderrText.trim() || `${plan.cmd} exited with code ${exitCode}`)
    }
  }

  await cleanup()
}

export function cancelTurn(turnId: string): void {
  const turn = active.get(turnId)
  if (!turn) return
  turn.cancelled = true
  try {
    turn.proc.kill()
  } catch {
    // already exited
  }
}
