import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import Markdown from "react-markdown"
import remarkGfm from "remark-gfm"

/** Typography for exported documents — self-contained, no external assets,
 *  honors the reader's OS appearance. */
const EXPORT_CSS = `
  :root { color-scheme: light dark; }
  body {
    margin: 0 auto;
    max-width: 44rem;
    padding: 3rem 1.5rem 6rem;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    line-height: 1.75;
    color: #1c1c22;
    background: #ffffff;
  }
  h1, h2, h3, h4, h5, h6 { line-height: 1.3; margin: 1.4em 0 0.5em; }
  h1 { font-size: 2em; } h2 { font-size: 1.5em; } h3 { font-size: 1.25em; }
  p, ul, ol { margin: 0 0 0.9em; }
  ul, ol { padding-left: 1.5em; }
  a { color: #6553e8; }
  blockquote {
    border-left: 3px solid #6553e8;
    margin: 1em 0; padding: 0.2em 0 0.2em 1em;
    color: #55555f; font-style: italic;
  }
  code {
    font-family: "SF Mono", "JetBrains Mono", Menlo, monospace;
    font-size: 0.875em; background: rgba(20, 20, 30, 0.06);
    padding: 0.1em 0.35em; border-radius: 4px;
  }
  pre { background: rgba(20, 20, 30, 0.05); border-radius: 8px; padding: 1em; overflow-x: auto; }
  pre code { background: none; padding: 0; }
  img { max-width: 100%; }
  table { border-collapse: collapse; width: 100%; margin-bottom: 1em; }
  th, td { border: 1px solid rgba(20, 20, 30, 0.15); padding: 0.4em 0.8em; text-align: left; }
  th { background: rgba(20, 20, 30, 0.04); }
  hr { border: none; border-top: 1px solid rgba(20, 20, 30, 0.15); margin: 2em 0; }
  @media (prefers-color-scheme: dark) {
    body { color: rgba(255, 255, 255, 0.9); background: #101014; }
    a { color: #9d8dfa; }
    blockquote { color: rgba(255, 255, 255, 0.6); border-color: #9d8dfa; }
    code { background: rgba(255, 255, 255, 0.09); }
    pre { background: rgba(255, 255, 255, 0.06); }
    th, td { border-color: rgba(255, 255, 255, 0.18); }
    th { background: rgba(255, 255, 255, 0.05); }
    hr { border-color: rgba(255, 255, 255, 0.18); }
  }
`

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
}

/** Render markdown to a standalone HTML document. Raw HTML in the source is
 *  inert (react-markdown never injects it), and relative asset paths are kept
 *  as-is so an export saved beside the .md keeps its images. */
export function buildExportHtml(title: string, markdown: string): string {
  const body = renderToStaticMarkup(
    createElement(Markdown, { remarkPlugins: [remarkGfm] }, markdown),
  )
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<style>${EXPORT_CSS}</style>
</head>
<body>
${body}
</body>
</html>
`
}
