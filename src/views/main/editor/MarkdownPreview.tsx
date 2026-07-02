import ReactMarkdown, { defaultUrlTransform } from "react-markdown"
import rehypeRaw from "rehype-raw"
import remarkGfm from "remark-gfm"
import { memo, forwardRef, useEffect, useState, type ComponentPropsWithoutRef } from "react"
import { isInlineImageDataUrl, shouldBridgeMarkdownImage } from "./markdownImageUrls"

interface MarkdownPreviewProps {
  readonly content: string
  readonly activeFilePath?: string | null
}

function initialMarkdownImageSrc(src: string | undefined, activeFilePath: string | null | undefined): string | undefined {
  if (shouldBridgeMarkdownImage(src, activeFilePath)) return undefined
  return src
}

export function shouldLoadMarkdownImage(url: string | undefined, activeFilePath: string | null | undefined): boolean {
  return shouldBridgeMarkdownImage(url, activeFilePath)
}

function useMarkdownImageSrc(src: string | undefined, activeFilePath: string | null | undefined): string | undefined {
  const [resolvedSrc, setResolvedSrc] = useState<string | undefined>(() => initialMarkdownImageSrc(src, activeFilePath))

  useEffect(() => {
    if (!activeFilePath || !src || !shouldBridgeMarkdownImage(src, activeFilePath)) {
      setResolvedSrc(src)
      return
    }

    let cancelled = false
    const markdownPath = activeFilePath
    const imageUrl = src
    void import("../rpc/client")
      .then(({ rpc }) => rpc.request.readMarkdownImage({ markdownPath, imageUrl }))
      .then((dataUrl) => {
        if (!cancelled) setResolvedSrc(dataUrl ?? undefined)
      })
    return () => {
      cancelled = true
    }
  }, [activeFilePath, src])

  return resolvedSrc
}

type MarkdownImageProps = ComponentPropsWithoutRef<"img"> & {
  readonly activeFilePath?: string | null
}

function MarkdownImage({ activeFilePath, src, alt, ...props }: MarkdownImageProps) {
  const resolvedSrc = useMarkdownImageSrc(src, activeFilePath)
  const imageSrc = resolvedSrc && resolvedSrc.length > 0 ? resolvedSrc : undefined
  return <img {...props} src={imageSrc} alt={alt ?? ""} />
}

export const MarkdownPreview = memo(forwardRef<HTMLDivElement, MarkdownPreviewProps>(
  function MarkdownPreview({ content, activeFilePath }, ref) {
    return (
      <div
        ref={ref}
        className="editor-content h-full overflow-y-auto px-8 py-6"
        style={{ color: "var(--color-text-primary)" }}
      >
        {content.trim() ? (
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeRaw]}
            urlTransform={(url, key, node) => {
              if (key === "src" && node.tagName === "img" && isInlineImageDataUrl(url)) return url
              if (key === "src" && node.tagName === "img" && shouldBridgeMarkdownImage(url, activeFilePath)) return url
              return defaultUrlTransform(url)
            }}
            components={{
              img({ node: _node, src, alt, ...props }) {
                return <MarkdownImage {...props} src={src} alt={alt} activeFilePath={activeFilePath} />
              },
            }}
          >
            {content}
          </ReactMarkdown>
        ) : (
          <p style={{ color: "var(--color-text-placeholder)" }}>Preview will appear here…</p>
        )}
      </div>
    )
  },
))
