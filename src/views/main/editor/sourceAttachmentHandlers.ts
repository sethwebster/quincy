import type { Extension } from "@codemirror/state"
import { EditorView } from "@codemirror/view"
import type { EditorSelectionRange } from "../../../shared/types"
import { rpc } from "../rpc/client"
import { fileItemsFromDataTransfer, type MarkdownAttachmentResolver } from "./markdownAttachmentHelpers"

interface AttachmentInsertion {
  readonly view: EditorView
  readonly range: EditorSelectionRange
  readonly markdown: string
  readonly userEvent: string
}

interface AttachmentResolutionRequest {
  readonly view: EditorView
  readonly files: readonly File[]
  readonly range: EditorSelectionRange
  readonly userEvent: string
  readonly resolveAttachments: MarkdownAttachmentResolver
}

function reportAttachmentError(error: unknown): void {
  if (error instanceof Error) {
    rpc.send.log({ level: "error", msg: error.message })
    return
  }
  throw error
}

function dispatchAttachmentInsertion({ view, range, markdown, userEvent }: AttachmentInsertion): void {
  view.dispatch({
    changes: { from: range.from, to: range.to, insert: markdown },
    selection: { anchor: range.from + markdown.length },
    userEvent,
  })
}

function insertResolvedAttachments({
  view,
  files,
  range,
  userEvent,
  resolveAttachments,
}: AttachmentResolutionRequest): void {
  void resolveAttachments(files)
    .then((markdown) => {
      if (markdown) dispatchAttachmentInsertion({ view, range, markdown, userEvent })
    })
    .catch(reportAttachmentError)
}

export function sourceAttachmentHandlers(resolveAttachments?: MarkdownAttachmentResolver): Extension {
  if (!resolveAttachments) return []

  return EditorView.domEventHandlers({
    paste(event, view) {
      const files = fileItemsFromDataTransfer(event.clipboardData)
      if (files.length === 0) return false

      event.preventDefault()
      const selection = view.state.selection.main
      insertResolvedAttachments({
        view,
        files,
        range: { from: selection.from, to: selection.to },
        userEvent: "input.paste",
        resolveAttachments,
      })
      return true
    },
    drop(event, view) {
      const files = fileItemsFromDataTransfer(event.dataTransfer)
      if (files.length === 0) return false

      const position = view.posAtCoords({ x: event.clientX, y: event.clientY })
      if (position === null) return false

      event.preventDefault()
      insertResolvedAttachments({
        view,
        files,
        range: { from: position, to: position },
        userEvent: "input.drop",
        resolveAttachments,
      })
      return true
    },
  })
}
