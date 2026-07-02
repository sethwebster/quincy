import { describe, expect, test } from "bun:test"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { MarkdownPreview, shouldLoadMarkdownImage } from "./MarkdownPreview"

describe("shouldLoadMarkdownImage", () => {
  test("loads README-relative image paths through the app bridge", () => {
    expect(shouldLoadMarkdownImage("docs/images/mode-rich-text.png", "/Users/seth/quincy/README.md")).toBe(
      true,
    )
  })

  test("loads file-url image paths through the app bridge", () => {
    expect(shouldLoadMarkdownImage("file:///Users/seth/quincy/docs/images/mode-rich-text.png", "/Users/seth/quincy/README.md")).toBe(
      true,
    )
  })

  test("does not bridge remote and root-relative image paths", () => {
    expect(shouldLoadMarkdownImage("https://example.com/image.png", "/Users/seth/quincy/README.md")).toBe(false)
    expect(shouldLoadMarkdownImage("/docs/images/image.png", "/Users/seth/quincy/README.md")).toBe(false)
  })

  test("does not bridge without an active file", () => {
    expect(shouldLoadMarkdownImage("docs/images/mode-rich-text.png", null)).toBe(
      false,
    )
  })

  test("does not emit file urls into rendered markdown", () => {
    const markup = renderToStaticMarkup(createElement(MarkdownPreview, {
      content: "![Rich Text](docs/images/mode-rich-text.png)",
      activeFilePath: "/Users/seth/quincy/README.md",
    }))

    expect(markup).not.toContain("file://")
  })

  test("renders inline image data URLs from embedded attachments", () => {
    const dataUrl = "data:image/png;base64,iVBORw0KGgo="
    const markup = renderToStaticMarkup(createElement(MarkdownPreview, {
      content: `![Inline](${dataUrl})`,
      activeFilePath: "/Users/seth/quincy/README.md",
    }))

    expect(markup).toContain(`src="${dataUrl}"`)
  })

  test("does not render non-image data URLs from markdown content", () => {
    const markup = renderToStaticMarkup(createElement(MarkdownPreview, {
      content: "![Inline](data:text/html;base64,PGgxPkJvb208L2gxPg==)",
      activeFilePath: "/Users/seth/quincy/README.md",
    }))

    expect(markup).not.toContain("src=")
  })

  test("does not render direct non-image file urls from markdown content", () => {
    const markup = renderToStaticMarkup(createElement(MarkdownPreview, {
      content: "![Secret](file:///etc/passwd)",
      activeFilePath: "/Users/seth/quincy/README.md",
    }))

    expect(markup).not.toContain("src=")
  })
})
