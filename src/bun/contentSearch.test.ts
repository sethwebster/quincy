import { describe, expect, test } from "bun:test"
import { findContentMatches } from "./contentSearch"

describe("findContentMatches", () => {
  test("should find a match with its 1-based line number", () => {
    const matches = findContentMatches("first\nsecond target line\nthird", "target")
    expect(matches).toEqual([{ lineNumber: 2, snippet: "second target line" }])
  })

  test("should match case-insensitively", () => {
    const matches = findContentMatches("Some TARGET here", "target")
    expect(matches).toHaveLength(1)
  })

  test("should cap matches at maxMatches", () => {
    const content = Array.from({ length: 10 }, (_, i) => `line ${i} target`).join("\n")
    expect(findContentMatches(content, "target", 3)).toHaveLength(3)
  })

  test("should return one match per line even with repeats in a line", () => {
    const matches = findContentMatches("target target target", "target")
    expect(matches).toHaveLength(1)
  })

  test("should return empty for an empty query", () => {
    expect(findContentMatches("anything", "")).toEqual([])
  })

  test("should return empty when nothing matches", () => {
    expect(findContentMatches("abc\ndef", "zzz")).toEqual([])
  })

  test("should trim long lines into an ellipsized snippet around the match", () => {
    const line = `${"a".repeat(100)} target ${"b".repeat(100)}`
    const [match] = findContentMatches(line, "target")
    expect(match?.snippet.startsWith("…")).toBe(true)
    expect(match?.snippet.endsWith("…")).toBe(true)
    expect(match?.snippet).toContain("target")
    expect(match!.snippet.length).toBeLessThan(line.length)
  })
})
