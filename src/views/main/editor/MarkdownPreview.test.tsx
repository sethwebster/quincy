import { describe, expect, test } from "bun:test"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"

import { MarkdownPreview } from "./MarkdownPreview"

describe("MarkdownPreview", () => {
  test("renders trusted inline HTML in markdown", () => {
    const html = renderToStaticMarkup(createElement(MarkdownPreview, { content: "alpha<br>beta" }))

    expect(html).toContain("<br/>")
    expect(html).not.toContain("&lt;br&gt;")
  })
})
