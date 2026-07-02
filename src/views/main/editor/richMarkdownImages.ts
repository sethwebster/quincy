import { Extension } from "@tiptap/core"
import type { Node as ProseMirrorNode } from "@tiptap/pm/model"
import { Plugin, PluginKey } from "@tiptap/pm/state"
import { Decoration, DecorationSet } from "@tiptap/pm/view"
import { useEffect, type RefObject } from "react"
import { shouldBridgeMarkdownImage } from "./markdownImageUrls"

const RICH_MARKDOWN_IMAGE_SRC = "data-markdown-image-src"
const EMPTY_IMAGE_SRC = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=="

export function richMarkdownImageAttributes(
  src: string | undefined,
  activeFilePath: string | null | undefined,
): Record<string, string> | null {
  if (!shouldBridgeMarkdownImage(src, activeFilePath) || !src) return null
  return { src: EMPTY_IMAGE_SRC, [RICH_MARKDOWN_IMAGE_SRC]: src }
}

function richMarkdownImageDecorations(
  doc: ProseMirrorNode,
  activeFilePath: string | null | undefined,
): DecorationSet {
  const decorations: Decoration[] = []
  doc.descendants((node, pos) => {
    if (node.type.name !== "image") return
    const attrs = richMarkdownImageAttributes(
      typeof node.attrs.src === "string" ? node.attrs.src : undefined,
      activeFilePath,
    )
    if (attrs) decorations.push(Decoration.node(pos, pos + node.nodeSize, attrs))
  })
  return DecorationSet.create(doc, decorations)
}

export function richMarkdownImageBridge(activeFilePath: string | null | undefined): Extension {
  return Extension.create({
    name: "richMarkdownImageBridge",
    addProseMirrorPlugins() {
      const key = new PluginKey("richMarkdownImageBridge")
      return [
        new Plugin({
          key,
          props: {
            decorations(state) {
              return richMarkdownImageDecorations(state.doc, activeFilePath)
            },
          },
        }),
      ]
    },
  })
}

export function useResolvedRichMarkdownImages(
  containerRef: RefObject<HTMLElement | null>,
  activeFilePath: string | null | undefined,
  content: string,
): void {
  useEffect(() => {
    const container = containerRef.current
    if (!container || !activeFilePath) return

    let cancelled = false
    const images = Array.from(container.querySelectorAll<HTMLImageElement>(`img[${RICH_MARKDOWN_IMAGE_SRC}]`))
    for (const image of images) {
      const imageUrl = image.getAttribute(RICH_MARKDOWN_IMAGE_SRC)
      if (!imageUrl) continue
      void import("../rpc/client")
        .then(({ rpc }) => rpc.request.readMarkdownImage({ markdownPath: activeFilePath, imageUrl }))
        .then((dataUrl) => {
          if (!cancelled && dataUrl) image.src = dataUrl
        })
    }

    return () => {
      cancelled = true
    }
  }, [activeFilePath, containerRef, content])
}
