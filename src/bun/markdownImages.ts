import { existsSync, readFileSync } from "node:fs"
import { dirname, extname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const IMAGE_MIME_TYPES: Readonly<Record<string, string>> = {
  ".avif": "image/avif",
  ".gif": "image/gif",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
}

const URL_SCHEME = /^[A-Za-z][A-Za-z\d+.-]*:/

export function isRelativeMarkdownImageUrl(url: string): boolean {
  return url.length > 0 && !url.startsWith("#") && !url.startsWith("/") && !url.startsWith("//") && !URL_SCHEME.test(url)
}

export function isLocalMarkdownImageUrl(url: string): boolean {
  return isRelativeMarkdownImageUrl(url) || url.startsWith("file://")
}

function filePathFromImageUrl(imageUrl: string): string | null {
  const path = imageUrl.split(/[?#]/, 1)[0] ?? ""
  try {
    return decodeURI(path)
  } catch (error) {
    if (error instanceof URIError) return null
    throw error
  }
}

export function resolveMarkdownImagePath(markdownPath: string, imageUrl: string): string | null {
  if (imageUrl.startsWith("file://")) {
    try {
      const imagePath = fileURLToPath(imageUrl)
      return IMAGE_MIME_TYPES[extname(imagePath).toLowerCase()] ? imagePath : null
    } catch (error) {
      if (error instanceof TypeError) return null
      throw error
    }
  }

  if (!isRelativeMarkdownImageUrl(imageUrl)) return null

  const imagePath = filePathFromImageUrl(imageUrl)
  if (!imagePath) return null

  const resolvedPath = resolve(dirname(markdownPath), imagePath)
  return IMAGE_MIME_TYPES[extname(resolvedPath).toLowerCase()] ? resolvedPath : null
}

export function readMarkdownImageDataUrl(markdownPath: string, imageUrl: string): string | null {
  const imagePath = resolveMarkdownImagePath(markdownPath, imageUrl)
  if (!imagePath || !existsSync(imagePath)) return null

  const mimeType = IMAGE_MIME_TYPES[extname(imagePath).toLowerCase()]
  if (!mimeType) return null

  return `data:${mimeType};base64,${readFileSync(imagePath).toString("base64")}`
}
