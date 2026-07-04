/**
 * Rich mode round-trip safety.
 *
 * Rich mode parses markdown into TipTap's schema and re-serializes on every
 * keystroke; constructs the schema can't represent are silently dropped the
 * moment the user types. This detector flags those constructs BEFORE the user
 * enters rich mode so we can warn instead of losing content.
 */

import { Extension, Node } from "@tiptap/core"
import type { Node as ProseMirrorNode } from "@tiptap/pm/model"
import { Plugin, PluginKey } from "@tiptap/pm/state"
import { Decoration, DecorationSet } from "@tiptap/pm/view"

const RAW_HTML_ATTR = "data-raw-html"
const RAW_HTML_BLOCK_TAG = "quincy-raw-html-block"
const RAW_HTML_INLINE_TAG = "quincy-raw-html-inline"
const RAW_HTML_ALIGNMENT_VALUES = ["left", "center", "right", "justify"] as const

type RawHtmlAlignment = (typeof RAW_HTML_ALIGNMENT_VALUES)[number]

interface RawHtmlScope {
  readonly tag: string
  readonly alignment: RawHtmlAlignment | null
}

function isRawHtmlAlignment(value: string): value is RawHtmlAlignment {
  return RAW_HTML_ALIGNMENT_VALUES.some((alignment) => alignment === value)
}

interface MarkdownItToken {
  readonly content: string
}

interface MarkdownItRendererSelf {
  readonly renderToken: MarkdownItRenderRule
}

type MarkdownItRenderRule = (
  tokens: readonly MarkdownItToken[],
  index: number,
  options: unknown,
  env: unknown,
  self: MarkdownItRendererSelf,
) => string

interface MarkdownItParser {
  readonly renderer: {
    readonly rules: Record<string, MarkdownItRenderRule | undefined>
  }
}

interface MarkdownSerializerState {
  write(content?: string): void
  closeBlock(node: ProseMirrorNode): void
}

interface RawHtmlMarkdownStorage {
  readonly markdown: {
    readonly serialize: (state: MarkdownSerializerState, node: ProseMirrorNode) => void
    readonly parse: {
      readonly setup: (markdownit: MarkdownItParser) => void
    }
  }
}

class RawHtmlAttributeError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "RawHtmlAttributeError"
  }
}

function rawHtmlAttribute(node: ProseMirrorNode): string {
  const attrs: Record<string, unknown> = node.attrs
  const raw = attrs[RAW_HTML_ATTR]
  if (typeof raw !== "string" || raw.length === 0) {
    throw new RawHtmlAttributeError(`Missing ${RAW_HTML_ATTR} on ${node.type.name}`)
  }
  return raw
}

function encodedRawHtmlAttribute(element: HTMLElement): string {
  const encoded = element.getAttribute(RAW_HTML_ATTR)
  if (!encoded) throw new RawHtmlAttributeError(`Missing ${RAW_HTML_ATTR} on ${element.tagName.toLowerCase()}`)
  try {
    return decodeURIComponent(encoded)
  } catch (error) {
    if (error instanceof URIError) {
      throw new RawHtmlAttributeError(`Malformed ${RAW_HTML_ATTR} on ${element.tagName.toLowerCase()}`)
    }
    throw error
  }
}

function rawHtmlElement(tag: string, raw: string): string {
  return `<${tag} ${RAW_HTML_ATTR}="${encodeURIComponent(raw)}"></${tag}>`
}

function rawHtmlRenderer(tag: string): MarkdownItRenderRule {
  return (tokens, index) => rawHtmlElement(tag, tokens[index]?.content ?? "")
}

function rawHtmlAlignment(value: string | undefined): RawHtmlAlignment | null {
  if (!value) return null
  const normalized = value.trim().toLowerCase()
  return isRawHtmlAlignment(normalized) ? normalized : null
}

function rawHtmlOpeningScope(raw: string): RawHtmlScope | null {
  const match = /^<\s*([a-z][\w:-]*)\b([\s\S]*?)\s*>$/i.exec(raw.trim())
  if (!match || /\/\s*>$/.test(raw.trim())) return null

  const attrs = match[2] ?? ""
  const alignMatch = /\balign\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/i.exec(attrs)
  return {
    tag: match[1].toLowerCase(),
    alignment: rawHtmlAlignment(alignMatch?.[1] ?? alignMatch?.[2] ?? alignMatch?.[3]),
  }
}

function rawHtmlClosingTag(raw: string): string | null {
  const match = /^<\s*\/\s*([a-z][\w:-]*)\s*>$/i.exec(raw.trim())
  return match ? match[1].toLowerCase() : null
}

function activeRawHtmlAlignment(scopes: readonly RawHtmlScope[]): RawHtmlAlignment | null {
  for (let index = scopes.length - 1; index >= 0; index -= 1) {
    const alignment = scopes[index]?.alignment
    if (alignment) return alignment
  }
  return null
}

function closeRawHtmlScope(scopes: RawHtmlScope[], tag: string): void {
  for (let index = scopes.length - 1; index >= 0; index -= 1) {
    if (scopes[index]?.tag !== tag) continue
    scopes.splice(index)
    return
  }
}

function rawHtmlMarkdownStorage(kind: "block" | "inline"): RawHtmlMarkdownStorage {
  return {
    markdown: {
      serialize(state, node) {
        state.write(rawHtmlAttribute(node))
        if (kind === "block") state.closeBlock(node)
      },
      parse: {
        setup(markdownit) {
          if (kind === "block") markdownit.renderer.rules.html_block = rawHtmlRenderer(RAW_HTML_BLOCK_TAG)
          else markdownit.renderer.rules.html_inline = rawHtmlRenderer(RAW_HTML_INLINE_TAG)
        },
      },
    },
  }
}

const rawHtmlAttributes = {
  [RAW_HTML_ATTR]: {
    default: "",
    parseHTML: encodedRawHtmlAttribute,
  },
}

const rawHtmlBlockNode = Node.create<{}, RawHtmlMarkdownStorage>({
  name: "rawHtmlBlock",
  group: "block",
  atom: true,
  selectable: false,
  addAttributes() {
    return rawHtmlAttributes
  },
  parseHTML() {
    return [{ tag: RAW_HTML_BLOCK_TAG }]
  },
  renderHTML({ node }) {
    return [RAW_HTML_BLOCK_TAG, { [RAW_HTML_ATTR]: encodeURIComponent(rawHtmlAttribute(node)) }]
  },
  addStorage() {
    return rawHtmlMarkdownStorage("block")
  },
})

const rawHtmlInlineNode = Node.create<{}, RawHtmlMarkdownStorage>({
  name: "rawHtmlInline",
  group: "inline",
  inline: true,
  atom: true,
  selectable: false,
  addAttributes() {
    return rawHtmlAttributes
  },
  parseHTML() {
    return [{ tag: RAW_HTML_INLINE_TAG }]
  },
  renderHTML({ node }) {
    return [RAW_HTML_INLINE_TAG, { [RAW_HTML_ATTR]: encodeURIComponent(rawHtmlAttribute(node)) }]
  },
  addStorage() {
    return rawHtmlMarkdownStorage("inline")
  },
})

function rawHtmlAlignmentDecorations(doc: ProseMirrorNode): DecorationSet {
  const decorations: Decoration[] = []
  const scopes: RawHtmlScope[] = []

  doc.descendants((node, pos) => {
    if (node.type.name === "rawHtmlBlock") {
      const raw = rawHtmlAttribute(node)
      const closingTag = rawHtmlClosingTag(raw)
      if (closingTag) closeRawHtmlScope(scopes, closingTag)
      else {
        const scope = rawHtmlOpeningScope(raw)
        if (scope) scopes.push(scope)
      }
      return false
    }

    if (!node.isBlock) return true

    const alignment = activeRawHtmlAlignment(scopes)
    if (alignment) {
      decorations.push(Decoration.node(pos, pos + node.nodeSize, { style: `text-align: ${alignment}` }))
    }
    return true
  })

  return DecorationSet.create(doc, decorations)
}

const rawHtmlAlignmentExtension = Extension.create({
  name: "rawHtmlAlignment",
  addProseMirrorPlugins() {
    const key = new PluginKey("rawHtmlAlignment")
    return [
      new Plugin({
        key,
        props: {
          decorations(state) {
            return rawHtmlAlignmentDecorations(state.doc)
          },
        },
      }),
    ]
  },
})

export const richMarkdownRawHtmlBridge = [rawHtmlBlockNode, rawHtmlInlineNode, rawHtmlAlignmentExtension]

/** Remove fenced code blocks and inline code — their contents are literal and
 *  survive the round-trip, so they must not trigger false positives. */
function stripCode(markdown: string): string {
  return markdown
    .replace(/^(```|~~~)[^\n]*\n[\s\S]*?^\1[^\n]*$/gm, "")
    .replace(/`[^`\n]*`/g, "")
}

/** Human-readable names of constructs that will NOT survive rich mode. */
export function detectLossyMarkdown(markdown: string): string[] {
  const risks: string[] = []
  if (/^---\r?\n[\s\S]*?\r?\n---(\r?\n|$)/.test(markdown)) risks.push("YAML frontmatter")

  const prose = stripCode(markdown)
  if (/\[\^[^\]\s]+\]/.test(prose)) risks.push("footnotes")
  if (/\$\$[\s\S]+?\$\$/.test(prose)) risks.push("math")
  return risks
}
