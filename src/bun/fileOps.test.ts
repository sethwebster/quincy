import { describe, expect, test } from "bun:test"
import { mkdtempSync, writeFileSync, existsSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import {
  normalizeMarkdownFileName,
  renameMarkdownFile,
  uniqueName,
  validateMarkdownFileName,
} from "./fileOps"

describe("validateMarkdownFileName", () => {
  test("should accept a plain name", () => {
    expect(validateMarkdownFileName("notes.md")).toBeNull()
    expect(validateMarkdownFileName("notes")).toBeNull()
  })

  test("should reject empty and whitespace-only names", () => {
    expect(validateMarkdownFileName("")).toMatch(/empty/)
    expect(validateMarkdownFileName("   ")).toMatch(/empty/)
  })

  test("should reject path separators", () => {
    expect(validateMarkdownFileName("a/b.md")).toMatch(/slash/)
    expect(validateMarkdownFileName("a\\b.md")).toMatch(/slash/)
  })

  test("should reject hidden names", () => {
    expect(validateMarkdownFileName(".secret.md")).toMatch(/dot/)
  })
})

describe("normalizeMarkdownFileName", () => {
  test("should append .md when missing", () => {
    expect(normalizeMarkdownFileName("notes")).toBe("notes.md")
  })

  test("should keep an existing extension, case-insensitively", () => {
    expect(normalizeMarkdownFileName("notes.md")).toBe("notes.md")
    expect(normalizeMarkdownFileName("notes.MD")).toBe("notes.MD")
  })

  test("should trim surrounding whitespace", () => {
    expect(normalizeMarkdownFileName("  notes  ")).toBe("notes.md")
  })
})

describe("uniqueName", () => {
  test("should return the name unchanged when free", () => {
    expect(uniqueName("a.md", () => false)).toBe("a.md")
  })

  test("should suffix a counter before the extension on collision", () => {
    const taken = new Set(["a.md", "a 2.md"])
    expect(uniqueName("a.md", (c) => taken.has(c))).toBe("a 3.md")
  })
})

describe("renameMarkdownFile", () => {
  test("should rename within the same directory and return the new path", () => {
    const dir = mkdtempSync(join(tmpdir(), "quincy-fileops-"))
    const original = join(dir, "old.md")
    writeFileSync(original, "content")
    const newPath = renameMarkdownFile(original, "new")
    expect(newPath).toBe(join(dir, "new.md"))
    expect(existsSync(newPath)).toBe(true)
    expect(existsSync(original)).toBe(false)
  })

  test("should refuse to overwrite an existing file", () => {
    const dir = mkdtempSync(join(tmpdir(), "quincy-fileops-"))
    writeFileSync(join(dir, "a.md"), "a")
    writeFileSync(join(dir, "b.md"), "b")
    expect(() => renameMarkdownFile(join(dir, "a.md"), "b.md")).toThrow(/exists/)
  })

  test("should be a no-op when the name is unchanged", () => {
    const dir = mkdtempSync(join(tmpdir(), "quincy-fileops-"))
    const path = join(dir, "same.md")
    writeFileSync(path, "x")
    expect(renameMarkdownFile(path, "same.md")).toBe(path)
  })

  test("should allow case-only renames on a case-insensitive filesystem", () => {
    const dir = mkdtempSync(join(tmpdir(), "quincy-fileops-"))
    const path = join(dir, "Readme.md")
    writeFileSync(path, "x")
    const newPath = renameMarkdownFile(path, "readme.md")
    expect(newPath).toBe(join(dir, "readme.md"))
  })

  test("should reject invalid names", () => {
    const dir = mkdtempSync(join(tmpdir(), "quincy-fileops-"))
    const path = join(dir, "a.md")
    writeFileSync(path, "x")
    expect(() => renameMarkdownFile(path, "../escape")).toThrow(/slash/)
  })
})
