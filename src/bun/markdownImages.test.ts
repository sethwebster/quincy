import { describe, expect, test } from "bun:test"
import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { readMarkdownImageDataUrl, resolveMarkdownImagePath } from "./markdownImages"

describe("resolveMarkdownImagePath", () => {
  test("resolves README-relative image paths beside the markdown file", () => {
    expect(resolveMarkdownImagePath("/Users/seth/quincy/README.md", "docs/images/mode-rich-text.png")).toBe(
      "/Users/seth/quincy/docs/images/mode-rich-text.png",
    )
  })

  test("rejects non-relative and non-image paths", () => {
    expect(resolveMarkdownImagePath("/Users/seth/quincy/README.md", "https://example.com/image.png")).toBeNull()
    expect(resolveMarkdownImagePath("/Users/seth/quincy/README.md", "docs/readme.txt")).toBeNull()
  })

  test("resolves file urls that point to image files", () => {
    expect(resolveMarkdownImagePath("/Users/seth/quincy/README.md", "file:///Users/seth/quincy/docs/images/mode-rich-text.png")).toBe(
      "/Users/seth/quincy/docs/images/mode-rich-text.png",
    )
    expect(resolveMarkdownImagePath("/Users/seth/quincy/README.md", "file:///etc/passwd")).toBeNull()
  })
})

describe("readMarkdownImageDataUrl", () => {
  test("returns a data url for a local markdown image", () => {
    const root = join(tmpdir(), `quincy-markdown-image-${Date.now()}`)
    mkdirSync(join(root, "docs", "images"), { recursive: true })
    writeFileSync(join(root, "README.md"), "![Image](docs/images/pixel.png)")
    writeFileSync(join(root, "docs", "images", "pixel.png"), Uint8Array.from([137, 80, 78, 71]))

    expect(readMarkdownImageDataUrl(join(root, "README.md"), "docs/images/pixel.png")).toBe(
      "data:image/png;base64,iVBORw==",
    )
  })

  test("returns a data url for a file-url markdown image", () => {
    const root = join(tmpdir(), `quincy-markdown-file-image-${Date.now()}`)
    mkdirSync(join(root, "docs", "images"), { recursive: true })
    writeFileSync(join(root, "docs", "images", "pixel.png"), Uint8Array.from([137, 80, 78, 71]))

    expect(readMarkdownImageDataUrl(join(root, "README.md"), `file://${join(root, "docs", "images", "pixel.png")}`)).toBe(
      "data:image/png;base64,iVBORw==",
    )
  })
})
