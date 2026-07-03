import { CodeBlockLowlight } from "@tiptap/extension-code-block-lowlight"
import { Fragment, createElement, type ReactNode } from "react"
import type { ElementContent, Root, RootContent } from "hast"
import { common, createLowlight } from "lowlight"

export const LANGUAGE_CLASS_PREFIX = "language-"

const lowlightCore = createLowlight(common)

function highlightAutoPlainText(value: string): Root {
  return { type: "root", children: [{ type: "text", value }] }
}

export const editorLowlight = {
  highlight: lowlightCore.highlight,
  highlightAuto: highlightAutoPlainText,
  listLanguages: lowlightCore.listLanguages,
  registered: lowlightCore.registered,
}

export const richMarkdownCodeBlock = CodeBlockLowlight.configure({
  lowlight: editorLowlight,
  languageClassPrefix: LANGUAGE_CLASS_PREFIX,
})

export function languageFromClassName(className: string | undefined): string | null {
  const languageClass = className?.split(" ").find((name) => name.startsWith(LANGUAGE_CLASS_PREFIX))
  if (!languageClass) return null
  return languageClass.slice(LANGUAGE_CLASS_PREFIX.length)
}

function elementClassName(node: ElementContent): string | undefined {
  if (node.type !== "element") return undefined
  const className = node.properties.className
  if (typeof className === "string") return className
  if (Array.isArray(className)) {
    return className.filter((value): value is string => typeof value === "string").join(" ")
  }
  return undefined
}

function renderHighlightNode(node: RootContent, index: number): ReactNode {
  switch (node.type) {
    case "text":
      return node.value
    case "element":
      return createElement(
        node.tagName,
        { key: index, className: elementClassName(node) },
        node.children.map((child, childIndex) => renderHighlightNode(child, childIndex)),
      )
    case "comment":
    case "doctype":
      return null
  }
}

export function renderHighlightedCode(code: string, language: string): ReactNode | null {
  if (!editorLowlight.registered(language)) return null
  const tree = editorLowlight.highlight(language, code)
  return createElement(Fragment, null, tree.children.map((node, index) => renderHighlightNode(node, index)))
}
