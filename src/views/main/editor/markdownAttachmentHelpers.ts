import type { MarkdownAttachmentStorageMode } from "../../../shared/types"

export type MarkdownAttachmentResolver = (files: readonly File[]) => Promise<string | null>

export interface AttachmentMarkdownInput {
  readonly name: string
  readonly mimeType: string
  readonly url: string
}

export interface AttachmentStorageDefaultInput {
  readonly activeFilePath: string | null
  readonly preference: MarkdownAttachmentStorageMode | null
}

export interface FileListLike {
  readonly length: number
  item(index: number): File | null
}

export interface FileTransferLike {
  readonly files?: FileListLike | null
}

export interface AttachmentFileData {
  readonly name: string
  readonly mimeType: string
  readonly base64Data: string
}

function isImageMimeType(mimeType: string): boolean {
  return mimeType.startsWith("image/")
}

function escapeMarkdownLabel(name: string): string {
  return name.replace(/\\/g, "\\\\").replace(/\[/g, "\\[").replace(/\]/g, "\\]")
}

export function attachmentMarkdown({ name, mimeType, url }: AttachmentMarkdownInput): string {
  const label = escapeMarkdownLabel(name)
  return isImageMimeType(mimeType) ? `![${label}](${url})` : `[${label}](${url})`
}

export function defaultAttachmentStorageMode({
  activeFilePath,
  preference,
}: AttachmentStorageDefaultInput): MarkdownAttachmentStorageMode {
  if (preference === "inline") return "inline"
  if (preference === "sidecar" && activeFilePath) return "sidecar"
  return activeFilePath ? "sidecar" : "inline"
}

export function fileItemsFromDataTransfer(transfer: FileTransferLike | null): readonly File[] {
  const files = transfer?.files
  if (!files || files.length === 0) return []

  const result: File[] = []
  for (let index = 0; index < files.length; index += 1) {
    const file = files.item(index)
    if (file) result.push(file)
  }
  return result
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ""
  const chunkSize = 8192
  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize)
    binary += String.fromCharCode(...chunk)
  }
  return btoa(binary)
}

export async function readAttachmentFile(file: File): Promise<AttachmentFileData> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  return {
    name: file.name || "attachment",
    mimeType: file.type || "application/octet-stream",
    base64Data: bytesToBase64(bytes),
  }
}

export function inlineAttachmentUrl(file: AttachmentFileData): string {
  return `data:${file.mimeType};base64,${file.base64Data}`
}
