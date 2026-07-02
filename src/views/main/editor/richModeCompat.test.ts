import { describe, expect, test } from "bun:test"
import { Editor } from "@tiptap/core"
import StarterKit from "@tiptap/starter-kit"
import { Window } from "happy-dom"
import { Markdown } from "tiptap-markdown"
import { detectLossyMarkdown, richMarkdownRawHtmlBridge } from "./richModeCompat"

const browserWindow = new Window()
Object.assign(globalThis, {
  window: browserWindow,
  document: browserWindow.document,
  Node: browserWindow.Node,
  HTMLElement: browserWindow.HTMLElement,
  DOMParser: browserWindow.DOMParser,
  MutationObserver: browserWindow.MutationObserver,
  navigator: browserWindow.navigator,
  getComputedStyle: browserWindow.getComputedStyle,
})

function roundTripMarkdown(markdown: string): string {
  const editor = new Editor({
    content: markdown,
    extensions: [StarterKit, ...richMarkdownRawHtmlBridge, Markdown.configure({ html: true })],
  })
  const output = editor.storage.markdown.getMarkdown()
  editor.destroy()
  return output
}

describe("detectLossyMarkdown", () => {
  test("should return no risks for plain CommonMark", () => {
    const md = "# Title\n\nSome **bold** text.\n\n- a list\n- item\n\n> quote\n"
    expect(detectLossyMarkdown(md)).toEqual([])
  })

  test("should detect YAML frontmatter", () => {
    const md = "---\ntitle: Doc\n---\n\n# Body\n"
    expect(detectLossyMarkdown(md)).toContain("YAML frontmatter")
  })

  test("should not flag a thematic break mid-document as frontmatter", () => {
    const md = "# Title\n\n---\n\nMore text\n"
    expect(detectLossyMarkdown(md)).toEqual([])
  })

  test("should not detect preserved raw HTML", () => {
    const md = "Some text\n\n<div class=\"warning\">careful</div>\n"
    expect(detectLossyMarkdown(md)).not.toContain("raw HTML")
  })

  test("should not flag HTML inside fenced code blocks", () => {
    const md = "```html\n<div>example</div>\n```\n"
    expect(detectLossyMarkdown(md)).toEqual([])
  })

  test("should not flag HTML inside inline code", () => {
    const md = "Use the `<div>` element.\n"
    expect(detectLossyMarkdown(md)).toEqual([])
  })

  test("should detect footnotes", () => {
    const md = "A claim[^1].\n\n[^1]: The source.\n"
    expect(detectLossyMarkdown(md)).toContain("footnotes")
  })

  test("should detect display math", () => {
    const md = "$$\nE = mc^2\n$$\n"
    expect(detectLossyMarkdown(md)).toContain("math")
  })

  test("should not flag dollar amounts as math", () => {
    const md = "It costs $5 today and $10 tomorrow.\n"
    expect(detectLossyMarkdown(md)).toEqual([])
  })

  test("should report multiple risks at once", () => {
    const md = "---\na: 1\n---\n\n<span>hi</span> and a note[^n]\n\n[^n]: note\n"
    const risks = detectLossyMarkdown(md)
    expect(risks).toContain("YAML frontmatter")
    expect(risks).toContain("footnotes")
  })
})

describe("richMarkdownRawHtmlBridge", () => {
  test("should preserve README-style raw HTML block tags", () => {
    const md = "<div align=\"center\">\n\n# Quincy\n\n</div>"
    expect(roundTripMarkdown(md)).toBe(md)
  })

  test("should preserve inline br source", () => {
    const md = "Line one<br />line two"
    expect(roundTripMarkdown(md)).toBe(md)
  })

  test("should preserve repeated raw HTML snippets", () => {
    const md = "<br />\n<br />\n\n<div align=\"center\">\n\n</div>"
    expect(roundTripMarkdown(md)).toBe(md)
  })

  test("should preserve raw HTML in mixed markdown order", () => {
    const md = "# Title\n\n<div align=\"center\">\n\n**bold**\n\n</div>\n\nAfter <br /> done"
    expect(roundTripMarkdown(md)).toBe(md)
  })

  test("should ignore HTML-looking text inside code", () => {
    const md = "`<br />`\n\n```html\n<div align=\"center\">\n</div>\n```"
    expect(roundTripMarkdown(md)).toBe(md)
  })
})
