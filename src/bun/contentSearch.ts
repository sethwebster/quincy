/** Pure content-match logic for workspace full-text search. */

export interface ContentMatch {
  lineNumber: number
  snippet: string
}

const SNIPPET_CONTEXT_CHARS = 40

function makeSnippet(line: string, index: number, matchLength: number): string {
  const start = Math.max(0, index - SNIPPET_CONTEXT_CHARS)
  const end = Math.min(line.length, index + matchLength + SNIPPET_CONTEXT_CHARS)
  const prefix = start > 0 ? "…" : ""
  const suffix = end < line.length ? "…" : ""
  return prefix + line.slice(start, end).trim() + suffix
}

/** Case-insensitive substring matches, one per line, capped at `maxMatches`. */
export function findContentMatches(
  content: string,
  query: string,
  maxMatches = 3,
): ContentMatch[] {
  if (!query) return []
  const needle = query.toLowerCase()
  const lines = content.split("\n")
  const matches: ContentMatch[] = []
  for (let i = 0; i < lines.length && matches.length < maxMatches; i += 1) {
    const line = lines[i] ?? ""
    const index = line.toLowerCase().indexOf(needle)
    if (index === -1) continue
    matches.push({ lineNumber: i + 1, snippet: makeSnippet(line, index, query.length) })
  }
  return matches
}
