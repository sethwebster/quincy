import { useEditor as useTipTap, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Placeholder from "@tiptap/extension-placeholder"
import Table from "@tiptap/extension-table"
import TableCell from "@tiptap/extension-table-cell"
import TableHeader from "@tiptap/extension-table-header"
import TableRow from "@tiptap/extension-table-row"
import type { Editor } from "@tiptap/core"
import { Markdown } from "tiptap-markdown"
import { useEffect, useRef } from "react"
import type { EditorSelectionRange } from "../../../shared/types"

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
  placeholder?: string
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
  placeholder = "Start writing…",
}: RichTextEditorProps) {
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const onSelectionChangeRef = useRef(onSelectionChange)
  onSelectionChangeRef.current = onSelectionChange
  const onSearchIndexChangeRef = useRef(onSearchIndexChange)
  onSearchIndexChangeRef.current = onSearchIndexChange

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
    },
    onUpdate: ({ editor }) => {
      internalUpdateRef.current = true
      const md = editor.storage.markdown.getMarkdown() as string
      onChangeRef.current(md)
      onSearchIndexChangeRef.current?.(buildRichSearchIndex(editor))
    },
    onCreate: ({ editor }) => {
      onSearchIndexChangeRef.current?.(buildRichSearchIndex(editor))
    },
    onSelectionUpdate: ({ editor }) => {
      const { from, to } = editor.state.selection
      onSelectionChangeRef.current?.({ from, to })
    },
  })

  useTipTapSelection(editor, selection)

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
