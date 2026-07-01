import { describe, expect, test } from "bun:test"
import {
  findAppBundlePath,
  markdownPathFromFileUrl,
  normalizeMarkdownFilePath,
} from "./markdownFileAssociations"

describe("normalizeMarkdownFilePath", () => {
  test("accepts markdown file extensions", () => {
    expect(normalizeMarkdownFilePath("/Users/seth/Notes/todo.md")).toBe("/Users/seth/Notes/todo.md")
    expect(normalizeMarkdownFilePath("/Users/seth/Notes/todo.markdown")).toBe("/Users/seth/Notes/todo.markdown")
    expect(normalizeMarkdownFilePath("/Users/seth/Notes/todo.MD")).toBe("/Users/seth/Notes/todo.MD")
  })

  test("rejects non-markdown paths", () => {
    expect(normalizeMarkdownFilePath("/Users/seth/Notes/todo.txt")).toBeNull()
    expect(normalizeMarkdownFilePath("   ")).toBeNull()
  })
})

describe("markdownPathFromFileUrl", () => {
  test("decodes markdown file urls", () => {
    expect(markdownPathFromFileUrl("file:///Users/seth/My%20Notes/todo.md")).toBe("/Users/seth/My Notes/todo.md")
  })

  test("rejects non-file and non-markdown urls", () => {
    expect(markdownPathFromFileUrl("https://example.com/todo.md")).toBeNull()
    expect(markdownPathFromFileUrl("file:///Users/seth/Notes/todo.txt")).toBeNull()
    expect(markdownPathFromFileUrl("not a url")).toBeNull()
  })
})

describe("findAppBundlePath", () => {
  test("finds enclosing app bundle", () => {
    expect(findAppBundlePath("/Applications/Quincy.app/Contents/MacOS/bun")).toBe("/Applications/Quincy.app")
  })

  test("returns null outside an app bundle", () => {
    expect(findAppBundlePath("/usr/local/bin/bun")).toBeNull()
  })
})
