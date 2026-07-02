import { describe, expect, test } from "bun:test"
import { DocumentSaver } from "./documentSaver"

function deferred<T = void>() {
  let resolve!: (value: T) => void
  let reject!: (err: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

interface Recorded {
  writes: Array<{ path: string; content: string }>
  saved: Array<{ path: string; content: string }>
  errors: Array<{ path: string; error: unknown }>
}

function makeSaver(opts?: {
  debounceMs?: number
  write?: (path: string, content: string) => Promise<void>
}) {
  const recorded: Recorded = { writes: [], saved: [], errors: [] }
  const write =
    opts?.write ??
    (async (path: string, content: string) => {
      recorded.writes.push({ path, content })
    })
  const saver = new DocumentSaver({
    write: async (path, content) => {
      await write(path, content)
      if (opts?.write) recorded.writes.push({ path, content })
    },
    onSaved: (path, content) => recorded.saved.push({ path, content }),
    onError: (path, error) => recorded.errors.push({ path, error }),
    debounceMs: opts?.debounceMs ?? 10,
  })
  return { saver, recorded }
}

describe("DocumentSaver", () => {
  test("should write the latest content once after the debounce window", async () => {
    const { saver, recorded } = makeSaver()
    saver.schedule("/a.md", "one")
    saver.schedule("/a.md", "two")
    await sleep(30)
    expect(recorded.writes).toEqual([{ path: "/a.md", content: "two" }])
    expect(recorded.saved).toEqual([{ path: "/a.md", content: "two" }])
  })

  test("should not lose content scheduled while a write is in flight (DL-1)", async () => {
    const gate = deferred()
    const { saver, recorded } = makeSaver({
      write: async () => {
        await gate.promise
      },
    })
    saver.schedule("/a.md", "A")
    await sleep(20) // debounce fires; write("A") now in flight
    saver.schedule("/a.md", "B") // user types during the write
    gate.resolve() // write("A") completes
    await sleep(30) // B's debounce fires and must still write
    expect(recorded.writes).toEqual([
      { path: "/a.md", content: "A" },
      { path: "/a.md", content: "B" },
    ])
    expect(recorded.saved.at(-1)).toEqual({ path: "/a.md", content: "B" })
  })

  test("should report each save so the caller can compare against current content", async () => {
    const { saver, recorded } = makeSaver()
    saver.schedule("/a.md", "hello")
    await sleep(30)
    expect(recorded.saved).toEqual([{ path: "/a.md", content: "hello" }])
  })

  test("should flush pending content immediately without waiting for the debounce (DL-2)", async () => {
    const { saver, recorded } = makeSaver({ debounceMs: 5_000 })
    saver.schedule("/a.md", "unsaved")
    await saver.flush()
    expect(recorded.writes).toEqual([{ path: "/a.md", content: "unsaved" }])
    expect(recorded.saved).toEqual([{ path: "/a.md", content: "unsaved" }])
  })

  test("should preserve the original path when flushing after the active file changed", async () => {
    const { saver, recorded } = makeSaver({ debounceMs: 5_000 })
    saver.schedule("/old.md", "old edits")
    // Caller switches files, then flushes the old pending save.
    await saver.flush()
    expect(recorded.writes).toEqual([{ path: "/old.md", content: "old edits" }])
  })

  test("should serialize flush with an in-flight write and land the newest content", async () => {
    const gate = deferred()
    let calls = 0
    const { saver, recorded } = makeSaver({
      write: async () => {
        calls += 1
        if (calls === 1) await gate.promise
      },
    })
    saver.schedule("/a.md", "A")
    await sleep(20) // write("A") in flight
    saver.schedule("/a.md", "B")
    const flushed = saver.flush()
    gate.resolve()
    await flushed
    expect(recorded.writes).toEqual([
      { path: "/a.md", content: "A" },
      { path: "/a.md", content: "B" },
    ])
  })

  test("should resolve flush as a no-op when nothing is pending", async () => {
    const { saver, recorded } = makeSaver()
    await saver.flush()
    expect(recorded.writes).toEqual([])
  })

  test("should report write failures and keep the doc unsaved", async () => {
    const boom = new Error("disk full")
    const { saver, recorded } = makeSaver({
      write: async () => {
        throw boom
      },
    })
    saver.schedule("/a.md", "data")
    await sleep(30)
    expect(recorded.saved).toEqual([])
    expect(recorded.errors).toEqual([{ path: "/a.md", error: boom }])
  })

  test("should retry failed content on the next flush", async () => {
    let fail = true
    const { saver, recorded } = makeSaver({
      write: async () => {
        if (fail) throw new Error("transient")
      },
    })
    saver.schedule("/a.md", "data")
    await sleep(30)
    expect(recorded.writes).toEqual([])
    fail = false
    await saver.flush()
    expect(recorded.writes).toEqual([{ path: "/a.md", content: "data" }])
    expect(recorded.saved).toEqual([{ path: "/a.md", content: "data" }])
  })

  test("should not retry failed content when newer content was scheduled", async () => {
    let fail = true
    const { saver, recorded } = makeSaver({
      write: async () => {
        if (fail) throw new Error("transient")
      },
    })
    saver.schedule("/a.md", "old")
    await sleep(30)
    fail = false
    saver.schedule("/a.md", "new")
    await saver.flush()
    expect(recorded.writes).toEqual([{ path: "/a.md", content: "new" }])
  })

  test("should drop pending content on cancel", async () => {
    const { saver, recorded } = makeSaver()
    saver.schedule("/a.md", "discard me")
    saver.cancel()
    await sleep(30)
    expect(recorded.writes).toEqual([])
  })
})
