import CodeMirror from "@uiw/react-codemirror"
import { markdown } from "@codemirror/lang-markdown"
import { languages } from "@codemirror/language-data"
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language"
import { tags } from "@lezer/highlight"
import { EditorView, keymap, type ViewUpdate } from "@codemirror/view"
import { search, searchKeymap } from "@codemirror/search"
import { useCallback, useEffect, useMemo, useRef } from "react"
import type { EditorSelectionRange } from "../../../shared/types"
import { useEditor } from "./EditorContext"
import { sourceAttachmentHandlers } from "./sourceAttachmentHandlers"
import type { MarkdownAttachmentResolver } from "./markdownAttachmentHelpers"

/** Minimal common-prefix/suffix diff so an AI edit becomes a single CM change. */
function diffRange(oldStr: string, newStr: string): { from: number; to: number; insert: string } {
  let start = 0
  const minLen = Math.min(oldStr.length, newStr.length)
  while (start < minLen && oldStr[start] === newStr[start]) start += 1
  let endOld = oldStr.length
  let endNew = newStr.length
  while (endOld > start && endNew > start && oldStr[endOld - 1] === newStr[endNew - 1]) {
    endOld -= 1
    endNew -= 1
  }
  return { from: start, to: endOld, insert: newStr.slice(start, endNew) }
}

interface SourceEditorProps {
  content: string
  onChange: (value: string) => void
  selection?: EditorSelectionRange | null
  onSelectionChange?: (selection: EditorSelectionRange) => void
  onResolveAttachments?: MarkdownAttachmentResolver
}

const editorTheme = EditorView.theme({
  "&": {
    background: "transparent !important",
    height: "100%",
  },
  "&.cm-focused": { outline: "none" },
  ".cm-gutters": {
    background: "transparent",
    border: "none",
    color: "var(--color-cm-gutter)",
    paddingRight: "8px",
  },
  ".cm-activeLineGutter": { background: "transparent" },
  ".cm-activeLine": { background: "var(--color-cm-active-line)" },
  ".cm-selectionBackground": { background: "var(--color-cm-selection) !important" },
  ".cm-cursor": { borderLeftColor: "var(--color-accent)" },
  ".cm-content": {
    caretColor: "var(--color-accent)",
    padding: "24px 32px",
    fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace',
    fontSize: "14px",
    lineHeight: "1.7",
    color: "var(--color-cm-text)",
  },
  ".cm-scroller": { overflow: "auto" },
})

const highlightStyle = HighlightStyle.define([
  // Headings
  { tag: tags.heading1, color: "var(--color-cm-heading)", fontWeight: "700", fontSize: "1.2em" },
  { tag: tags.heading2, color: "var(--color-cm-heading)", fontWeight: "700", fontSize: "1.1em" },
  { tag: tags.heading3, color: "var(--color-cm-heading)", fontWeight: "700" },
  { tag: tags.heading4, color: "var(--color-cm-heading)", fontWeight: "700" },
  { tag: tags.heading5, color: "var(--color-cm-heading)", fontWeight: "700" },
  { tag: tags.heading6, color: "var(--color-cm-text)", fontWeight: "700" },
  // Inline formatting
  { tag: tags.emphasis, color: "var(--color-cm-text)", fontStyle: "italic" },
  { tag: tags.strong, color: "var(--color-cm-heading)", fontWeight: "700" },
  { tag: tags.strikethrough, color: "var(--color-cm-meta)", textDecoration: "line-through" },
  // Links
  { tag: tags.link, color: "var(--color-accent)" },
  { tag: tags.url, color: "var(--color-cm-url)", textDecoration: "underline" },
  // Code
  { tag: tags.monospace, color: "var(--color-syntax-string)" },
  // Meta / separators (---, ```, frontmatter fences)
  { tag: tags.meta, color: "var(--color-cm-meta)" },
  { tag: tags.processingInstruction, color: "var(--color-cm-meta)" },
  { tag: tags.contentSeparator, color: "var(--color-cm-meta)" },
  // Quotes & comments
  { tag: tags.quote, color: "var(--color-cm-quote)", fontStyle: "italic" },
  { tag: tags.comment, color: "var(--color-cm-comment)", fontStyle: "italic" },
  // Lists
  { tag: tags.list, color: "var(--color-cm-dim)" },
  // Keywords / operators / atoms (catch-all for code blocks)
  { tag: tags.keyword, color: "var(--color-syntax-keyword)" },
  { tag: tags.operator, color: "var(--color-cm-dim)" },
  { tag: tags.atom, color: "var(--color-syntax-number)" },
  { tag: tags.bool, color: "var(--color-syntax-number)" },
  { tag: tags.number, color: "var(--color-syntax-number)" },
  { tag: tags.string, color: "var(--color-syntax-string)" },
  { tag: tags.regexp, color: "var(--color-syntax-regexp)" },
  // Names / identifiers
  { tag: tags.name, color: "var(--color-cm-text)" },
  { tag: tags.variableName, color: "var(--color-cm-text)" },
  { tag: tags.typeName, color: "var(--color-syntax-type)" },
  { tag: tags.className, color: "var(--color-syntax-type)" },
  { tag: tags.propertyName, color: "var(--color-syntax-property)" },
  { tag: tags.function(tags.variableName), color: "var(--color-syntax-property)" },
  { tag: tags.definition(tags.variableName), color: "var(--color-syntax-property)" },
  { tag: tags.labelName, color: "var(--color-cm-dim)" },
  // Tags (HTML/JSX)
  { tag: tags.tagName, color: "var(--color-syntax-tag)" },
  { tag: tags.attributeName, color: "var(--color-syntax-type)" },
  { tag: tags.attributeValue, color: "var(--color-syntax-string)" },
  { tag: tags.angleBracket, color: "var(--color-cm-punct)" },
  // Punctuation
  { tag: tags.paren, color: "var(--color-cm-punct)" },
  { tag: tags.brace, color: "var(--color-cm-punct)" },
  { tag: tags.squareBracket, color: "var(--color-cm-punct)" },
  { tag: tags.separator, color: "var(--color-cm-punct)" },
  { tag: tags.punctuation, color: "var(--color-cm-punct)" },
])

function useCodeMirrorSelection(
  viewRef: React.MutableRefObject<EditorView | null>,
  selection: EditorSelectionRange | null | undefined,
) {
  useEffect(() => {
    const view = viewRef.current
    if (!view || !selection) return
    const from = Math.max(0, Math.min(selection.from, view.state.doc.length))
    const to = Math.max(0, Math.min(selection.to, view.state.doc.length))
    const current = view.state.selection.main
    if (current.from === from && current.to === to) return
    view.dispatch({ selection: { anchor: from, head: to }, scrollIntoView: true })
  }, [selection, viewRef])
}

export function SourceEditor({ content, onChange, selection, onSelectionChange, onResolveAttachments }: SourceEditorProps) {
  const viewRef = useRef<EditorView | null>(null)
  const { registerEditorHandle } = useEditor()

  // Register an AI-edit handle that dispatches through CodeMirror's history so
  // Cmd-Z / Cmd-Shift-Z undo/redo the edit like manual input.
  useEffect(() => {
    registerEditorHandle({
      applyAssistantEdit(newContent) {
        const view = viewRef.current
        if (!view) return false
        const oldStr = view.state.doc.toString()
        if (oldStr === newContent) return true
        const change = diffRange(oldStr, newContent)
        view.dispatch({ changes: change, userEvent: "input" })
        return true
      },
    })
    return () => registerEditorHandle(null)
  }, [registerEditorHandle])
  const extensions = useMemo(() => [
    markdown({ codeLanguages: languages }),
    EditorView.lineWrapping,
    editorTheme,
    syntaxHighlighting(highlightStyle),
    search({ top: true }),
    keymap.of(searchKeymap),
    sourceAttachmentHandlers(onResolveAttachments),
  ], [onResolveAttachments])

  const handleChange = useCallback((value: string) => onChange(value), [onChange])
  const handleUpdate = useCallback((update: ViewUpdate) => {
    if (!update.selectionSet || !onSelectionChange) return
    const { from, to } = update.state.selection.main
    onSelectionChange({ from, to })
  }, [onSelectionChange])

  useCodeMirrorSelection(viewRef, selection)

  return (
    <div className="no-drag h-full overflow-hidden">
      <CodeMirror
        value={content}
        height="100%"
        extensions={extensions}
        onChange={handleChange}
        onUpdate={handleUpdate}
        onCreateEditor={(view) => { viewRef.current = view }}
        basicSetup={{
          lineNumbers: false,
          foldGutter: false,
          dropCursor: true,
          allowMultipleSelections: true,
          indentOnInput: true,
          bracketMatching: true,
          closeBrackets: true,
          autocompletion: false,
          rectangularSelection: true,
          crosshairCursor: false,
          highlightActiveLine: true,
          highlightActiveLineGutter: false,
          highlightSpecialChars: false,
          syntaxHighlighting: false,
        }}
        theme="none"
        style={{ height: "100%" }}
      />
    </div>
  )
}
