import { describe, expect, test } from "bun:test"
import { claudeBackend, codexBackend } from "./backends"

describe("claudeBackend.parseLine", () => {
  test("should extract text deltas from stream events", () => {
    const line = JSON.stringify({
      type: "stream_event",
      event: { type: "content_block_delta", delta: { type: "text_delta", text: "Hello" } },
    })
    expect(claudeBackend.parseLine(line)).toEqual({ textDelta: "Hello" })
  })

  test("should ignore non-text stream deltas", () => {
    const line = JSON.stringify({
      type: "stream_event",
      event: { type: "content_block_delta", delta: { type: "input_json_delta", partial_json: "{" } },
    })
    expect(claudeBackend.parseLine(line)).toBeNull()
  })

  test("should surface tool_use blocks with a friendly label", () => {
    const line = JSON.stringify({
      type: "assistant",
      message: { content: [{ type: "tool_use", name: "mcp__quincy__edit_document", input: {} }] },
    })
    expect(claudeBackend.parseLine(line)).toEqual({
      toolUse: { name: "mcp__quincy__edit_document", label: "Editing document" },
    })
  })

  test("should signal done on a success result", () => {
    expect(claudeBackend.parseLine(JSON.stringify({ type: "result", subtype: "success" }))).toEqual({ done: true })
  })

  test("should signal done with error on a non-success result", () => {
    const line = JSON.stringify({ type: "result", subtype: "error_during_execution", result: "boom" })
    expect(claudeBackend.parseLine(line)).toEqual({ done: true, error: "boom" })
  })

  test("should return null for non-JSON lines", () => {
    expect(claudeBackend.parseLine("not json")).toBeNull()
    expect(claudeBackend.parseLine("42")).toBeNull()
    expect(claudeBackend.parseLine("[1,2]")).toBeNull()
  })
})

describe("codexBackend.parseLine", () => {
  test("should extract agent message deltas", () => {
    const line = JSON.stringify({ msg: { type: "agent_message_delta", delta: "chunk" } })
    expect(codexBackend.parseLine(line)).toEqual({ textDelta: "chunk" })
  })

  test("should extract full agent messages", () => {
    const line = JSON.stringify({ type: "agent_message", text: "final text" })
    expect(codexBackend.parseLine(line)).toEqual({ textDelta: "final text" })
  })

  test("should surface MCP tool calls", () => {
    const line = JSON.stringify({ type: "mcp_tool_call_begin", name: "mcp__quincy__get_document" })
    expect(codexBackend.parseLine(line)).toEqual({
      toolUse: { name: "mcp__quincy__get_document", label: "Reading document" },
    })
  })

  test("should signal done on completion events", () => {
    expect(codexBackend.parseLine(JSON.stringify({ type: "task_complete" }))).toEqual({ done: true })
    expect(codexBackend.parseLine(JSON.stringify({ type: "turn.completed" }))).toEqual({ done: true })
  })

  test("should NOT treat item.completed as turn completion", () => {
    const reasoning = JSON.stringify({ type: "item.completed", item: { type: "reasoning", text: "thinking" } })
    expect(codexBackend.parseLine(reasoning)).toBeNull()
  })

  test("should extract agent message text from item.completed", () => {
    const line = JSON.stringify({
      type: "item.completed",
      item: { type: "agent_message", text: "final reply" },
    })
    expect(codexBackend.parseLine(line)).toEqual({ textDelta: "final reply" })
  })

  test("should surface tool calls from item events", () => {
    const line = JSON.stringify({
      type: "item.started",
      item: { type: "mcp_tool_call", name: "mcp__quincy__get_document" },
    })
    expect(codexBackend.parseLine(line)).toEqual({
      toolUse: { name: "mcp__quincy__get_document", label: "Reading document" },
    })
  })

  test("should signal done with message on error events", () => {
    const line = JSON.stringify({ type: "error", message: "codex exploded" })
    expect(codexBackend.parseLine(line)).toEqual({ done: true, error: "codex exploded" })
  })

  test("should return null for unknown or malformed lines", () => {
    expect(codexBackend.parseLine("���")).toBeNull()
    expect(codexBackend.parseLine(JSON.stringify({ type: "token_count" }))).toBeNull()
  })
})

describe("codexBackend.buildSpawn", () => {
  test("should never pass the sandbox bypass flag", () => {
    const plan = codexBackend.buildSpawn({
      prompt: "p",
      systemPreamble: "s",
      bridgeUrl: "http://127.0.0.1:1",
      bridgeToken: "t",
      mcpServerCmd: "bun",
      mcpServerArgs: ["server.ts"],
      tmpDir: "/tmp",
    })
    expect(plan.args).not.toContain("--dangerously-bypass-approvals-and-sandbox")
    expect(plan.args).toContain("--sandbox")
  })
})

describe("claudeBackend.buildSpawn", () => {
  test("should restrict tools to the quincy MCP tools only", () => {
    const plan = claudeBackend.buildSpawn({
      prompt: "p",
      systemPreamble: "s",
      bridgeUrl: "http://127.0.0.1:1",
      bridgeToken: "t",
      mcpServerCmd: "bun",
      mcpServerArgs: ["server.ts"],
      tmpDir: "/tmp",
    })
    const allowedIndex = plan.args.indexOf("--allowedTools")
    expect(allowedIndex).toBeGreaterThan(-1)
    expect(plan.args[allowedIndex + 1]).toBe("mcp__quincy__get_document,mcp__quincy__edit_document")
    expect(plan.args).toContain("--strict-mcp-config")
  })
})
