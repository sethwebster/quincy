import CodeMirror from "@uiw/react-codemirror"
import { markdown } from "@codemirror/lang-markdown"
import { languages } from "@codemirror/language-data"
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language"
import { tags } from "@lezer/highlight"
import { EditorView } from "@codemirror/view"
import { useCallback, useMemo } from "react"

interface SourceEditorProps {
  content: string
  onChange: (value: string) => void
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
})

const highlightStyle = HighlightStyle.define([
  // Headings
  { tag: tags.heading1, color: "rgba(255,255,255,0.98)", fontWeight: "700", fontSize: "1.2em" },
  { tag: tags.heading2, color: "rgba(255,255,255,0.98)", fontWeight: "700", fontSize: "1.1em" },
  { tag: tags.heading3, color: "rgba(255,255,255,0.98)", fontWeight: "700" },
  { tag: tags.heading4, color: "rgba(255,255,255,0.95)", fontWeight: "700" },
  { tag: tags.heading5, color: "rgba(255,255,255,0.92)", fontWeight: "700" },
  { tag: tags.heading6, color: "rgba(255,255,255,0.88)", fontWeight: "700" },
  // Inline formatting
  { tag: tags.emphasis, color: "rgba(255,255,255,0.85)", fontStyle: "italic" },
  { tag: tags.strong, color: "rgba(255,255,255,0.95)", fontWeight: "700" },
  { tag: tags.strikethrough, color: "rgba(255,255,255,0.45)", textDecoration: "line-through" },
  // Links
  { tag: tags.link, color: "var(--color-accent)" },
  { tag: tags.url, color: "rgba(124,106,247,0.7)", textDecoration: "underline" },
  // Code
  { tag: tags.monospace, color: "rgba(110,231,183,0.9)" },
  // Meta / separators (---, ```, frontmatter fences)
  { tag: tags.meta, color: "rgba(255,255,255,0.45)" },
  { tag: tags.processingInstruction, color: "rgba(255,255,255,0.45)" },
  { tag: tags.contentSeparator, color: "rgba(255,255,255,0.45)" },
  // Quotes & comments
  { tag: tags.quote, color: "rgba(255,255,255,0.55)", fontStyle: "italic" },
  { tag: tags.comment, color: "rgba(255,255,255,0.35)", fontStyle: "italic" },
  // Lists
  { tag: tags.list, color: "rgba(255,255,255,0.7)" },
  // Keywords / operators / atoms (catch-all for code blocks)
  { tag: tags.keyword, color: "rgba(199,146,234,0.95)" },
  { tag: tags.operator, color: "rgba(255,255,255,0.7)" },
  { tag: tags.atom, color: "rgba(255,180,84,0.95)" },
  { tag: tags.bool, color: "rgba(255,180,84,0.95)" },
  { tag: tags.number, color: "rgba(255,180,84,0.95)" },
  { tag: tags.string, color: "rgba(110,231,183,0.9)" },
  { tag: tags.regexp, color: "rgba(255,140,140,0.9)" },
  // Names / identifiers
  { tag: tags.name, color: "rgba(255,255,255,0.88)" },
  { tag: tags.variableName, color: "rgba(255,255,255,0.88)" },
  { tag: tags.typeName, color: "rgba(255,203,107,0.95)" },
  { tag: tags.className, color: "rgba(255,203,107,0.95)" },
  { tag: tags.propertyName, color: "rgba(130,170,255,0.95)" },
  { tag: tags.function(tags.variableName), color: "rgba(130,170,255,0.95)" },
  { tag: tags.definition(tags.variableName), color: "rgba(130,170,255,0.95)" },
  { tag: tags.labelName, color: "rgba(255,255,255,0.7)" },
  // Tags (HTML/JSX)
  { tag: tags.tagName, color: "rgba(255,140,140,0.95)" },
  { tag: tags.attributeName, color: "rgba(255,203,107,0.95)" },
  { tag: tags.attributeValue, color: "rgba(110,231,183,0.9)" },
  { tag: tags.angleBracket, color: "rgba(255,255,255,0.5)" },
  // Punctuation
  { tag: tags.paren, color: "rgba(255,255,255,0.6)" },
  { tag: tags.brace, color: "rgba(255,255,255,0.6)" },
  { tag: tags.squareBracket, color: "rgba(255,255,255,0.6)" },
  { tag: tags.separator, color: "rgba(255,255,255,0.5)" },
  { tag: tags.punctuation, color: "rgba(255,255,255,0.5)" },
])

export function SourceEditor({ content, onChange }: SourceEditorProps) {
  const extensions = useMemo(() => [
    markdown({ codeLanguages: languages }),
    EditorView.lineWrapping,
    editorTheme,
    syntaxHighlighting(highlightStyle),
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
          syntaxHighlighting: false,
        }}
        theme="none"
        style={{ height: "100%" }}
      />
    </div>
  )
}
