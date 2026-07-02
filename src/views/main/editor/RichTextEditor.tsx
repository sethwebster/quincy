import { useEditor as useTipTap, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Placeholder from "@tiptap/extension-placeholder"
import Table from "@tiptap/extension-table"
import TableCell from "@tiptap/extension-table-cell"
import TableHeader from "@tiptap/extension-table-header"
import TableRow from "@tiptap/extension-table-row"
import type { Editor } from "@tiptap/core"
import type { EditorView as ProseMirrorEditorView } from "@tiptap/pm/view"
import { Markdown } from "tiptap-markdown"
import { useEffect, useRef } from "react"
import type { EditorSelectionRange } from "../../../shared/types"
import { useEditor as useEditorContext } from "./EditorContext"
import { fileItemsFromDataTransfer, type MarkdownAttachmentResolver } from "./markdownAttachmentHelpers"
import { rpc } from "../rpc/client"

export interface RichSearchIndex {
  text: string
  positions: Array<number | null>
}

interface RichTextEditorProps {
  content: string
  onChange: (markdown: string) => void
  selection?: EditorSelectionRange | null
  onSelectionChange?: (selection: EditorSelectionRange) => void
  onSearchIndexChange?: (index: RichSearchIndex) => void
  onResolveAttachments?: MarkdownAttachmentResolver
  placeholder?: string
}

interface RichAttachmentInsertion {
  readonly editor: Editor
  readonly files: readonly File[]
  readonly resolveAttachments: MarkdownAttachmentResolver
  readonly position?: number
}

interface RichAttachmentDropInput {
  readonly view: ProseMirrorEditorView
  readonly event: DragEvent
  readonly editor: Editor | null
  readonly resolveAttachments?: MarkdownAttachmentResolver
}

function reportAttachmentError(error: unknown): void {
  if (error instanceof Error) {
    rpc.send.log({ level: "error", msg: error.message })
    return
  }
  throw error
}

function insertRichAttachments({ editor, files, resolveAttachments, position }: RichAttachmentInsertion): void {
  void resolveAttachments(files)
    .then((markdown) => {
      if (!markdown || editor.isDestroyed) return
      const chain = editor.chain().focus()
      if (position === undefined) chain.insertContent(markdown).run()
      else chain.insertContentAt(position, markdown).run()
    })
    .catch(reportAttachmentError)
}

function handleRichPaste(
  event: ClipboardEvent,
  editor: Editor | null,
  resolveAttachments: MarkdownAttachmentResolver | undefined,
): boolean {
  if (!editor || !resolveAttachments) return false
  const files = fileItemsFromDataTransfer(event.clipboardData)
  if (files.length === 0) return false
  event.preventDefault()
  insertRichAttachments({ editor, files, resolveAttachments })
  return true
}

function handleRichDrop({ view, event, editor, resolveAttachments }: RichAttachmentDropInput): boolean {
  if (!editor || !resolveAttachments) return false
  const files = fileItemsFromDataTransfer(event.dataTransfer)
  if (files.length === 0) return false
  const position = view.posAtCoords({ left: event.clientX, top: event.clientY })
  if (!position) return false
  event.preventDefault()
  insertRichAttachments({ editor, files, resolveAttachments, position: position.pos })
  return true
}

function buildRichSearchIndex(editor: Editor): RichSearchIndex {
  const text: string[] = []
  const positions: Array<number | null> = []
  let hasText = false

  editor.state.doc.descendants((node, pos) => {
    if (node.isBlock && hasText && positions[positions.length - 1] !== null) {
      text.push("\n")
      positions.push(null)
    }

    if (!node.isText || !node.text) return

    hasText = true
    for (let index = 0; index < node.text.length; index += 1) {
      text.push(node.text[index] ?? "")
      positions.push(pos + index)
    }
  })

  return { text: text.join(""), positions }
}

function useTipTapSelection(
  editor: ReturnType<typeof useTipTap>,
  selection: EditorSelectionRange | null | undefined,
) {
  useEffect(() => {
    if (!editor || !selection) return
    const { from, to } = editor.state.selection
    if (from === selection.from && to === selection.to) return
    editor.commands.setTextSelection(selection)
  }, [editor, selection])
}

export function RichTextEditor({
  content,
  onChange,
  selection,
  onSelectionChange,
  onSearchIndexChange,
  onResolveAttachments,
  placeholder = "Start writing…",
}: RichTextEditorProps) {
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const onSelectionChangeRef = useRef(onSelectionChange)
  onSelectionChangeRef.current = onSelectionChange
  const onSearchIndexChangeRef = useRef(onSearchIndexChange)
  onSearchIndexChangeRef.current = onSearchIndexChange
  const editorRef = useRef<Editor | null>(null)

  // Track whether the change is internal (user typing) vs external (prop update)
  const internalUpdateRef = useRef(false)

  const editor = useTipTap({
    extensions: [
      StarterKit,
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      Markdown,
      Placeholder.configure({ placeholder }),
    ],
    content,
    editorProps: {
      attributes: {
        class: "editor-content h-full outline-none",
      },
      handlePaste: (_view, event) => handleRichPaste(event, editorRef.current, onResolveAttachments),
      handleDrop: (view, event) => handleRichDrop({ view, event, editor: editorRef.current, resolveAttachments: onResolveAttachments }),
    },
    onUpdate: ({ editor }) => {
      internalUpdateRef.current = true
      const md = editor.storage.markdown.getMarkdown() as string
      onChangeRef.current(md)
      onSearchIndexChangeRef.current?.(buildRichSearchIndex(editor))
    },
    onCreate: ({ editor }) => {
      editorRef.current = editor
      onSearchIndexChangeRef.current?.(buildRichSearchIndex(editor))
    },
    onDestroy: () => {
      editorRef.current = null
    },
    onSelectionUpdate: ({ editor }) => {
      const { from, to } = editor.state.selection
      onSelectionChangeRef.current?.({ from, to })
    },
  })

  useTipTapSelection(editor, selection)

  // Register an AI-edit handle. `insertContentAt` over the whole doc (patched by
  // tiptap-markdown to parse markdown) produces a normal ProseMirror transaction
  // that goes into StarterKit's history → undoable with Cmd-Z / Cmd-Shift-Z.
  const { registerEditorHandle } = useEditorContext()
  useEffect(() => {
    if (!editor) return
    registerEditorHandle({
      applyAssistantEdit(newContent) {
        if (editor.isDestroyed) return false
        const size = editor.state.doc.content.size
        editor.chain().insertContentAt({ from: 0, to: size }, newContent).run()
        return true
      },
    })
    return () => registerEditorHandle(null)
  }, [editor, registerEditorHandle])

  // Sync external content changes (e.g. switching documents) without re-triggering onChange
  const prevContentRef = useRef(content)
  useEffect(() => {
    if (!editor || internalUpdateRef.current) {
      internalUpdateRef.current = false
      return
    }
    if (content !== prevContentRef.current) {
      prevContentRef.current = content
      const { from, to } = editor.state.selection
      editor.commands.setContent(content, false)
      try {
        editor.commands.setTextSelection({ from, to })
      } catch {
        // selection may be out of bounds after content change
      }
      onSearchIndexChangeRef.current?.(buildRichSearchIndex(editor))
    }
  }, [editor, content])

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="no-drag flex-1 overflow-y-auto px-8 py-6">
        <EditorContent editor={editor} className="h-full" />
      </div>
    </div>
  )
}
