import { describe, expect, test } from "bun:test"
import { computeEdit } from "./computeEdit"

describe("computeEdit", () => {
  test("should return full content replacement verbatim", () => {
    const result = computeEdit("old", { content: "new doc" })
    expect(result).toEqual({ ok: true, next: "new doc", summary: "Document updated." })
  })

  test("should replace every occurrence, not just the first", () => {
    const result = computeEdit("a foo b foo c foo", { find: "foo", replace: "bar" })
    expect(result).toEqual({
      ok: true,
      next: "a bar b bar c bar",
      summary: "Document updated (3 occurrences replaced).",
    })
  })

  test("should use singular wording for one occurrence", () => {
    const result = computeEdit("only foo here", { find: "foo", replace: "bar" })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.summary).toBe("Document updated (1 occurrence replaced).")
  })

  test("should error when find text is absent", () => {
    const result = computeEdit("nothing here", { find: "foo", replace: "bar" })
    expect(result).toEqual({ ok: false, error: "`find` text not found in the document." })
  })

  test("should error on an empty find string instead of looping", () => {
    const result = computeEdit("abc", { find: "", replace: "x" })
    expect(result.ok).toBe(false)
  })

  test("should error when neither content nor find/replace provided", () => {
    const result = computeEdit("abc", {})
    expect(result).toEqual({ ok: false, error: "Provide either `content`, or both `find` and `replace`." })
  })

  test("should not treat find as a regex", () => {
    const result = computeEdit("a.c abc", { find: "a.c", replace: "X" })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.next).toBe("X abc")
  })
})
