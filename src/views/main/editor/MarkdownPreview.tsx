import ReactMarkdown, { defaultUrlTransform } from "react-markdown"
import remarkGfm from "remark-gfm"
import { memo, forwardRef, useEffect, useState, type ComponentPropsWithoutRef } from "react"

interface MarkdownPreviewProps {
  readonly content: string
  readonly activeFilePath?: string | null
}

const URL_SCHEME = /^[A-Za-z][A-Za-z\d+.-]*:/
const INLINE_IMAGE_DATA_URL = /^data:image\/(?:png|jpe?g|gif|webp|avif|bmp);base64,[a-z\d+/]+=*$/i

function isRelativeUrl(url: string): boolean {
  return url.length > 0 && !url.startsWith("#") && !url.startsWith("/") && !url.startsWith("//") && !URL_SCHEME.test(url)
}

function isLocalImageUrl(url: string): boolean {
  return isRelativeUrl(url) || url.startsWith("file://")
}

function isInlineImageDataUrl(url: string): boolean {
  return INLINE_IMAGE_DATA_URL.test(url)
}

function initialMarkdownImageSrc(src: string | undefined, activeFilePath: string | null | undefined): string | undefined {
  if (activeFilePath && src && isLocalImageUrl(src)) return undefined
  return src
}

export function shouldLoadMarkdownImage(url: string | undefined, activeFilePath: string | null | undefined): boolean {
  return Boolean(activeFilePath && url && isLocalImageUrl(url))
}

function useMarkdownImageSrc(src: string | undefined, activeFilePath: string | null | undefined): string | undefined {
  const [resolvedSrc, setResolvedSrc] = useState<string | undefined>(() => initialMarkdownImageSrc(src, activeFilePath))

  useEffect(() => {
    if (!activeFilePath || !src || !isLocalImageUrl(src)) {
      setResolvedSrc(src)
      return
    }

    let cancelled = false
    void import("../rpc/client")
      .then(({ rpc }) => rpc.request.readMarkdownImage({ markdownPath: activeFilePath, imageUrl: src }))
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
            urlTransform={(url, key, node) => {
              if (key === "src" && node.tagName === "img" && isInlineImageDataUrl(url)) return url
              if (key === "src" && node.tagName === "img" && shouldLoadMarkdownImage(url, activeFilePath)) return url
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
