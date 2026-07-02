import { describe, expect, test } from "bun:test"
import { richMarkdownImageAttributes } from "./richMarkdownImages"

describe("richMarkdownImageAttributes", () => {
  test("prevents WebKit from resolving saved markdown images against views://main", () => {
    expect(richMarkdownImageAttributes("assets/README/photo.webp", "/Users/seth/quincy/README.md")).toEqual({
      src: "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==",
      "data-markdown-image-src": "assets/README/photo.webp",
    })
  })

  test("leaves remote and unsaved image URLs alone", () => {
    expect(richMarkdownImageAttributes("https://example.com/photo.webp", "/Users/seth/quincy/README.md")).toBeNull()
    expect(richMarkdownImageAttributes("assets/README/photo.webp", null)).toBeNull()
  })
})
