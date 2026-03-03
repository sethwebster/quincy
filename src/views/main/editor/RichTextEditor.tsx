import { useEditor as useTipTap, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Placeholder from "@tiptap/extension-placeholder"
import { Markdown } from "tiptap-markdown"
import { useEffect, useRef } from "react"

interface RichTextEditorProps {
  content: string
  onChange: (markdown: string) => void
  placeholder?: string
}

export function RichTextEditor({ content, onChange, placeholder = "Start writing…" }: RichTextEditorProps) {
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  // Track whether the change is internal (user typing) vs external (prop update)
  const internalUpdateRef = useRef(false)

  const editor = useTipTap({
    extensions: [
      StarterKit,
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
    },
  })

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
