import { describe, expect, test } from "bun:test"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { buildMarkdownAttachmentDataUrl, writeMarkdownAttachmentSidecar } from "./markdownAttachments"

describe("writeMarkdownAttachmentSidecar", () => {
  test("writes deterministic assets beside the markdown file", () => {
    const root = join(tmpdir(), `quincy-attachment-${Date.now()}`)
    const markdownPath = join(root, "notes", "Daily Log.md")

    const result = writeMarkdownAttachmentSidecar({
      markdownPath,
      name: "My Screenshot.PNG",
      mimeType: "image/png",
      base64Data: "iVBORw==",
    })

    expect(result.url).toBe("assets/Daily Log/my-screenshot-0f4636c7.png")
    expect(result.path).toBe(join(root, "notes", "assets", "Daily Log", "my-screenshot-0f4636c7.png"))
    expect(existsSync(result.path)).toBe(true)
    expect(readFileSync(result.path)).toEqual(Buffer.from([137, 80, 78, 71]))
  })

  test("keeps non-image file extensions and sanitizes empty names", () => {
    const root = join(tmpdir(), `quincy-attachment-file-${Date.now()}`)

    const result = writeMarkdownAttachmentSidecar({
      markdownPath: join(root, "README.md"),
      name: "---.PDF",
      mimeType: "application/pdf",
      base64Data: "AQID",
    })

    expect(result.url).toBe("assets/README/attachment-039058c6.pdf")
  })
})

describe("buildMarkdownAttachmentDataUrl", () => {
  test("builds an inline data URL", () => {
    expect(buildMarkdownAttachmentDataUrl({ mimeType: "text/plain", base64Data: "aGVsbG8=" })).toBe(
      "data:text/plain;base64,aGVsbG8=",
    )
  })
})
