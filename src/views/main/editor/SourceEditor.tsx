import CodeMirror from "@uiw/react-codemirror"
import { markdown } from "@codemirror/lang-markdown"
import { languages } from "@codemirror/language-data"
import { EditorView } from "@codemirror/view"
import { useCallback, useMemo } from "react"

interface SourceEditorProps {
  content: string
  onChange: (value: string) => void
}

const theme = EditorView.theme({
  "&": {
    background: "transparent !important",
    height: "100%",
  },
  "&.cm-focused": { outline: "none" },
  ".cm-gutters": {
    background: "transparent",
    border: "none",
    color: "rgba(255,255,255,0.2)",
    paddingRight: "8px",
  },
  ".cm-activeLineGutter": { background: "transparent" },
  ".cm-activeLine": { background: "rgba(255,255,255,0.03)" },
  ".cm-selectionBackground": { background: "rgba(124,106,247,0.25) !important" },
  ".cm-cursor": { borderLeftColor: "var(--color-accent)" },
  ".cm-content": {
    caretColor: "var(--color-accent)",
    padding: "24px 32px",
    fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace',
    fontSize: "14px",
    lineHeight: "1.7",
    color: "rgba(255,255,255,0.88)",
  },
  ".cm-scroller": { overflow: "auto" },
  // Markdown syntax highlighting
  ".tok-heading": { color: "rgba(255,255,255,0.98)", fontWeight: "700" },
  ".tok-heading1": { fontSize: "1.2em" },
  ".tok-heading2": { fontSize: "1.1em" },
  ".tok-emphasis": { color: "rgba(255,255,255,0.85)", fontStyle: "italic" },
  ".tok-strong": { color: "rgba(255,255,255,0.95)", fontWeight: "700" },
  ".tok-link": { color: "var(--color-accent)" },
  ".tok-url": { color: "rgba(124,106,247,0.7)", textDecoration: "underline" },
  ".tok-monospace": { color: "rgba(110,231,183,0.9)" },
  ".tok-meta": { color: "rgba(255,255,255,0.35)" },
  ".tok-comment": { color: "rgba(255,255,255,0.35)", fontStyle: "italic" },
  ".tok-quote": { color: "rgba(255,255,255,0.55)", fontStyle: "italic" },
})

export function SourceEditor({ content, onChange }: SourceEditorProps) {
  const extensions = useMemo(() => [
    markdown({ codeLanguages: languages }),
    EditorView.lineWrapping,
    theme,
  ], [])

  const handleChange = useCallback((value: string) => onChange(value), [onChange])

  return (
    <div className="no-drag h-full overflow-hidden">
      <CodeMirror
        value={content}
        height="100%"
        extensions={extensions}
        onChange={handleChange}
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
          syntaxHighlighting: true,
        }}
        style={{ height: "100%" }}
      />
    </div>
  )
}
