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

  test("renders highlighted fenced code for known languages", () => {
    const html = renderToStaticMarkup(createElement(MarkdownPreview, {
      content: "```javascript\nconst answer = 42\n```",
    }))

    expect(html).toContain("language-javascript")
    expect(html).toContain("hljs-keyword")
    expect(html).toContain("hljs-number")
  })

  test("renders unknown fenced code as plain code with its language class", () => {
    const html = renderToStaticMarkup(createElement(MarkdownPreview, {
      content: "```quincy\nconst answer = 42\n```",
    }))

    expect(html).toContain("language-quincy")
    expect(html).toContain("const answer = 42")
    expect(html).not.toContain("hljs-")
  })

  test("leaves inline code unhighlighted", () => {
    const html = renderToStaticMarkup(createElement(MarkdownPreview, {
      content: "Use `const answer = 42` inline.",
    }))

    expect(html).toContain("<code>const answer = 42</code>")
    expect(html).not.toContain("hljs-")
    expect(html).not.toContain("language-")
  })
})
