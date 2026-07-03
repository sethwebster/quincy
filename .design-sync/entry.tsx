// Curated design-system entry for /design-sync.
//
// Quincy is a desktop app, not a component library — there is no dist/ to
// bundle and a synth entry would `export * from` every src file, dragging
// Convex/RPC/Electrobun/TipTap/CodeMirror into the bundle. This file scopes
// the bundle to the presentational leaf components that render standalone.
//
// Passed to package-build.mjs / resync.mjs via `--entry .design-sync/entry.tsx`.
// The list must stay in sync with componentSrcMap in config.json.
export { Button } from "../src/views/main/components/Button"
export { Glass } from "../src/views/main/components/Glass"
export { Spinner } from "../src/views/main/components/Spinner"
export { ModeToggle } from "../src/views/main/editor/ModeToggle"
export { Toolbar } from "../src/views/main/editor/Toolbar"
export { FindReplacePanel } from "../src/views/main/editor/FindReplacePanel"
export { ChatMessage } from "../src/views/main/assistant/ChatMessage"
export { TreeContextMenu } from "../src/views/main/sidebar/TreeContextMenu"
export { MarkdownAttachmentStorageModal } from "../src/views/main/editor/MarkdownAttachmentStorageModal"
export { QuickOpenModal } from "../src/views/main/quickopen/QuickOpenModal"
