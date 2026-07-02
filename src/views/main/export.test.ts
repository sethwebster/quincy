import { describe, expect, test } from "bun:test"
import { buildExportHtml } from "./export"

describe("buildExportHtml", () => {
  test("should render markdown body to HTML", () => {
    const html = buildExportHtml("Doc", "# Hello\n\nSome **bold** text.")
    expect(html).toContain("<h1>Hello</h1>")
    expect(html).toContain("<strong>bold</strong>")
  })

  test("should render GFM tables", () => {
    const html = buildExportHtml("Doc", "| A | B |\n| - | - |\n| 1 | 2 |")
    expect(html).toContain("<table>")
    expect(html).toContain("<td>1</td>")
  })

  test("should be a complete standalone document with the title escaped", () => {
    const html = buildExportHtml("<script>alert(1)</script>", "text")
    expect(html.startsWith("<!DOCTYPE html>")).toBe(true)
    expect(html).toContain("</html>")
    expect(html).not.toContain("<script>alert(1)</script>")
    expect(html).toContain("&lt;script&gt;")
  })

  test("should keep relative image paths untouched", () => {
    const html = buildExportHtml("Doc", "![shot](images/shot.png)")
    expect(html).toContain('src="images/shot.png"')
  })

  test("should render raw HTML from the document as inert text, not live tags", () => {
    const html = buildExportHtml("Doc", "<img src=x onerror=alert(1)>")
    expect(html).not.toContain("<img src=x")
    expect(html).toContain("&lt;img")
  })
})
