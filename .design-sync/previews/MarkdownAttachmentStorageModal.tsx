import { MarkdownAttachmentStorageModal } from "quincy"

const noop = () => {}

// The modal is `position: fixed inset-0`. A wrapper with `transform` becomes the
// containing block for fixed descendants, so the overlay fills THIS box (and the
// card measures a real height) instead of collapsing against a 0-height mount.
const stage: React.CSSProperties = {
  position: "relative",
  width: "100%",
  height: 560,
  transform: "translateZ(0)",
  overflow: "hidden",
  background: "var(--color-surface-1)",
}

export const Dialog = () => (
  <div style={stage}>
    <MarkdownAttachmentStorageModal
      fileCount={1}
      defaultMode="sidecar"
      sidecarAvailable={true}
      onCancel={noop}
      onChoose={noop}
    />
  </div>
)

// When the document is unsaved, the side-car option is disabled and inline wins.
export const InlineOnly = () => (
  <div style={stage}>
    <MarkdownAttachmentStorageModal
      fileCount={3}
      defaultMode="inline"
      sidecarAvailable={false}
      onCancel={noop}
      onChoose={noop}
    />
  </div>
)
