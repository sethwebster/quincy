import { mkdirSync, writeFileSync } from "node:fs"
import { createHash } from "node:crypto"
import { basename, dirname, extname, join, relative } from "node:path"

const MIME_EXTENSION: Readonly<Record<string, string>> = {
  "application/pdf": "pdf",
  "image/avif": "avif",
  "image/gif": "gif",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/svg+xml": "svg",
  "image/webp": "webp",
  "text/plain": "txt",
}

export interface MarkdownAttachmentWriteInput {
  readonly markdownPath: string
  readonly name: string
  readonly mimeType: string
  readonly base64Data: string
}

export interface MarkdownAttachmentWriteResult {
  readonly path: string
  readonly url: string
}

export interface MarkdownAttachmentDataUrlInput {
  readonly mimeType: string
  readonly base64Data: string
}

function extensionFor(name: string, mimeType: string): string {
  const namedExtension = extname(name).replace(/^\./, "").toLowerCase()
  return namedExtension || MIME_EXTENSION[mimeType] || "bin"
}

function sanitizeAttachmentName(name: string): string {
  const withoutExtension = name.slice(0, name.length - extname(name).length)
  const sanitized = withoutExtension
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
  return sanitized || "attachment"
}

function markdownBasename(markdownPath: string): string {
  const name = basename(markdownPath)
  const extension = extname(name)
  return extension ? name.slice(0, name.length - extension.length) : name
}

function markdownRelativeUrl(markdownPath: string, attachmentPath: string): string {
  return relative(dirname(markdownPath), attachmentPath).split("\\").join("/")
}

export function buildMarkdownAttachmentDataUrl({ mimeType, base64Data }: MarkdownAttachmentDataUrlInput): string {
  return `data:${mimeType};base64,${base64Data}`
}

export function writeMarkdownAttachmentSidecar(input: MarkdownAttachmentWriteInput): MarkdownAttachmentWriteResult {
  const bytes = Uint8Array.from(Buffer.from(input.base64Data, "base64"))
  const hash = createHash("sha256").update(bytes).digest("hex").slice(0, 8)
  const extension = extensionFor(input.name, input.mimeType)
  const filename = `${sanitizeAttachmentName(input.name)}-${hash}.${extension}`
  const directory = join(dirname(input.markdownPath), "assets", markdownBasename(input.markdownPath))
  const path = join(directory, filename)

  mkdirSync(directory, { recursive: true })
  writeFileSync(path, bytes)

  return { path, url: markdownRelativeUrl(input.markdownPath, path) }
}
