const URL_SCHEME = /^[A-Za-z][A-Za-z\d+.-]*:/
const INLINE_IMAGE_DATA_URL = /^data:image\/(?:png|jpe?g|gif|webp|avif|bmp|svg\+xml);base64,[a-z\d+/]+=*$/i

export function isRelativeMarkdownImageUrl(url: string): boolean {
  return url.length > 0 && !url.startsWith("#") && !url.startsWith("/") && !url.startsWith("//") && !URL_SCHEME.test(url)
}

export function isLocalMarkdownImageUrl(url: string): boolean {
  return isRelativeMarkdownImageUrl(url) || url.startsWith("file://")
}

export function isInlineImageDataUrl(url: string): boolean {
  return INLINE_IMAGE_DATA_URL.test(url)
}

export function shouldBridgeMarkdownImage(url: string | undefined, activeFilePath: string | null | undefined): boolean {
  return Boolean(activeFilePath && url && isLocalMarkdownImageUrl(url))
}
