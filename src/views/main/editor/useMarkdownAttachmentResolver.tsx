import { useCallback, useMemo, useState } from "react"
import type { ReactNode } from "react"
import type { MarkdownAttachmentStorageMode } from "../../../shared/types"
import { rpc } from "../rpc/client"
import { MarkdownAttachmentStorageModal } from "./MarkdownAttachmentStorageModal"
import {
  attachmentMarkdown,
  defaultAttachmentStorageMode,
  inlineAttachmentUrl,
  readAttachmentFile,
  type AttachmentFileData,
  type MarkdownAttachmentResolver,
} from "./markdownAttachmentHelpers"

interface StorageDecision {
  readonly mode: MarkdownAttachmentStorageMode
  readonly persist: boolean
}

interface PendingChoice {
  readonly fileCount: number
  readonly defaultMode: MarkdownAttachmentStorageMode
  readonly resolve: (decision: StorageDecision | null) => void
}

interface MarkdownAttachmentResolverResult {
  readonly resolveAttachments: MarkdownAttachmentResolver
  readonly storageModal: ReactNode
}

async function sidecarUrl(activeFilePath: string, file: AttachmentFileData): Promise<string> {
  return rpc.request.writeMarkdownAttachment({
    markdownPath: activeFilePath,
    name: file.name,
    mimeType: file.mimeType,
    base64Data: file.base64Data,
  })
}

async function markdownForFile(
  file: AttachmentFileData,
  mode: MarkdownAttachmentStorageMode,
  activeFilePath: string | null,
): Promise<string> {
  const url = mode === "sidecar" && activeFilePath ? await sidecarUrl(activeFilePath, file) : inlineAttachmentUrl(file)
  return attachmentMarkdown({ name: file.name, mimeType: file.mimeType, url })
}

export function useMarkdownAttachmentResolver(activeFilePath: string | null): MarkdownAttachmentResolverResult {
  const [pendingChoice, setPendingChoice] = useState<PendingChoice | null>(null)

  const promptForStorage = useCallback((fileCount: number, defaultMode: MarkdownAttachmentStorageMode) => {
    return new Promise<StorageDecision | null>((resolve) => {
      setPendingChoice({ fileCount, defaultMode, resolve })
    })
  }, [])

  const resolveAttachments = useCallback<MarkdownAttachmentResolver>(async (files) => {
    if (files.length === 0) return null

    const prefs = await rpc.request.getPreferences({})
    const defaultMode = defaultAttachmentStorageMode({
      activeFilePath,
      preference: prefs.markdownAttachmentStorageMode,
    })
    const shouldPrompt = prefs.markdownAttachmentStorageMode === null || (prefs.markdownAttachmentStorageMode === "sidecar" && !activeFilePath)
    const decision = shouldPrompt ? await promptForStorage(files.length, defaultMode) : { mode: defaultMode, persist: false }
    if (!decision) return null

    if (decision.persist) {
      await rpc.request.setPreferences({ markdownAttachmentStorageMode: decision.mode })
    }

    const attachmentFiles = await Promise.all(files.map((file) => readAttachmentFile(file)))
    const markdownItems = await Promise.all(
      attachmentFiles.map((file) => markdownForFile(file, decision.mode, activeFilePath)),
    )

    return markdownItems.join("\n")
  }, [activeFilePath, promptForStorage])

  const storageModal = useMemo(() => {
    if (!pendingChoice) return null
    return (
      <MarkdownAttachmentStorageModal
        fileCount={pendingChoice.fileCount}
        defaultMode={pendingChoice.defaultMode}
        sidecarAvailable={Boolean(activeFilePath)}
        onCancel={() => {
          pendingChoice.resolve(null)
          setPendingChoice(null)
        }}
        onChoose={(mode, persist) => {
          pendingChoice.resolve({ mode, persist })
          setPendingChoice(null)
        }}
      />
    )
  }, [activeFilePath, pendingChoice])

  return { resolveAttachments, storageModal }
}
