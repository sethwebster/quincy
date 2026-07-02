import { useState } from "react"
import { motion } from "framer-motion"
import type { MarkdownAttachmentStorageMode } from "../../../shared/types"
import { Glass } from "../components/Glass"
import { Button } from "../components/Button"

interface MarkdownAttachmentStorageModalProps {
  readonly fileCount: number
  readonly defaultMode: MarkdownAttachmentStorageMode
  readonly sidecarAvailable: boolean
  readonly onCancel: () => void
  readonly onChoose: (mode: MarkdownAttachmentStorageMode, persist: boolean) => void
}

interface StorageChoiceProps {
  readonly mode: MarkdownAttachmentStorageMode
  readonly selected: boolean
  readonly disabled?: boolean
  readonly title: string
  readonly description: string
  readonly badge?: string
  readonly onSelect: (mode: MarkdownAttachmentStorageMode) => void
}

function StorageChoice({ mode, selected, disabled, title, description, badge, onSelect }: StorageChoiceProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onSelect(mode)}
      className="no-drag w-full rounded-lg px-3 py-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-45"
      style={{
        background: selected ? "var(--color-accent-dim)" : "var(--color-glass-bg)",
        border: selected ? "1px solid var(--color-accent)" : "1px solid var(--color-glass-border)",
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>{title}</span>
        {badge ? (
          <span className="rounded-md px-1.5 py-0.5 text-[11px] font-medium" style={{ background: "var(--color-accent-dim)", color: "var(--color-accent)" }}>
            {badge}
          </span>
        ) : null}
      </div>
      <p className="mt-1 text-xs leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>{description}</p>
    </button>
  )
}

export function MarkdownAttachmentStorageModal({
  fileCount,
  defaultMode,
  sidecarAvailable,
  onCancel,
  onChoose,
}: MarkdownAttachmentStorageModalProps) {
  const [mode, setMode] = useState<MarkdownAttachmentStorageMode>(defaultMode)

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center px-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.12 }}
    >
      <button
        type="button"
        aria-label="Cancel attachment storage"
        className="absolute inset-0 cursor-default"
        style={{ background: "var(--color-backdrop-modal)" }}
        onClick={onCancel}
      />
      <Glass elevated className="relative w-full max-w-[480px] rounded-xl p-4">
        <div className="space-y-1">
          <h2 className="text-base font-semibold" style={{ color: "var(--color-text-primary)" }}>Store attachment</h2>
          <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
            Choose how Quincy should add {fileCount === 1 ? "this file" : `${fileCount} files`} to the document.
          </p>
        </div>

        <div className="mt-4 space-y-2">
          <StorageChoice
            mode="sidecar"
            selected={mode === "sidecar"}
            disabled={!sidecarAvailable}
            title="Side-car file"
            description={sidecarAvailable ? "Recommended. Writes to assets beside this markdown file." : "Save this markdown file locally to enable side-car storage."}
            badge={sidecarAvailable ? "Recommended" : undefined}
            onSelect={setMode}
          />
          <StorageChoice
            mode="inline"
            selected={mode === "inline"}
            title="Inline data URL"
            description="Embeds the bytes directly in markdown. Works for unsaved documents."
            onSelect={setMode}
          />
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button type="button" variant="ghost" onClick={() => onChoose(mode, false)}>This time</Button>
          <Button type="button" variant="primary" onClick={() => onChoose(mode, true)}>Always</Button>
        </div>
      </Glass>
    </motion.div>
  )
}
