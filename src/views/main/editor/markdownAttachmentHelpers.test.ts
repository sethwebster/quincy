import { describe, expect, test } from "bun:test"
import {
  attachmentMarkdown,
  defaultAttachmentStorageMode,
  fileItemsFromDataTransfer,
} from "./markdownAttachmentHelpers"

describe("attachmentMarkdown", () => {
  test("uses image markdown for image attachments", () => {
    expect(attachmentMarkdown({ name: "Screenshot.png", mimeType: "image/png", url: "assets/doc/screenshot.png" })).toBe(
      "![Screenshot.png](assets/doc/screenshot.png)",
    )
  })

  test("uses link markdown for non-image attachments", () => {
    expect(attachmentMarkdown({ name: "Report.pdf", mimeType: "application/pdf", url: "data:application/pdf;base64,AQID" })).toBe(
      "[Report.pdf](data:application/pdf;base64,AQID)",
    )
  })
})

describe("defaultAttachmentStorageMode", () => {
  test("defaults to sidecar only for saved markdown files", () => {
    expect(defaultAttachmentStorageMode({ activeFilePath: "/Users/seth/README.md", preference: null })).toBe("sidecar")
    expect(defaultAttachmentStorageMode({ activeFilePath: null, preference: null })).toBe("inline")
  })

  test("uses saved preference when available and possible", () => {
    expect(defaultAttachmentStorageMode({ activeFilePath: "/Users/seth/README.md", preference: "inline" })).toBe("inline")
    expect(defaultAttachmentStorageMode({ activeFilePath: null, preference: "sidecar" })).toBe("inline")
  })
})

describe("fileItemsFromDataTransfer", () => {
  test("returns files from a drop or paste transfer", () => {
    const file = new File(["hello"], "hello.txt", { type: "text/plain" })
    const files = { length: 1, item: (index: number) => (index === 0 ? file : null) } as FileList

    expect(fileItemsFromDataTransfer({ files })).toEqual([file])
  })
})
