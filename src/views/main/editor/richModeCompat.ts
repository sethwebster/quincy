/**
 * Rich mode round-trip safety.
 *
 * Rich mode parses markdown into TipTap's schema and re-serializes on every
 * keystroke; constructs the schema can't represent are silently dropped the
 * moment the user types. This detector flags those constructs BEFORE the user
 * enters rich mode so we can warn instead of losing content.
 */

/** Remove fenced code blocks and inline code — their contents are literal and
 *  survive the round-trip, so they must not trigger false positives. */
function stripCode(markdown: string): string {
  return markdown
    .replace(/^(```|~~~)[^\n]*\n[\s\S]*?^\1[^\n]*$/gm, "")
    .replace(/`[^`\n]*`/g, "")
}

/** Human-readable names of constructs that will NOT survive rich mode. */
export function detectLossyMarkdown(markdown: string): string[] {
  const risks: string[] = []
  if (/^---\r?\n[\s\S]*?\r?\n---(\r?\n|$)/.test(markdown)) risks.push("YAML frontmatter")

  const prose = stripCode(markdown)
  if (/<[a-zA-Z][a-zA-Z0-9-]*(\s[^<>]*)?\/?>/.test(prose)) risks.push("raw HTML")
  if (/\[\^[^\]\s]+\]/.test(prose)) risks.push("footnotes")
  if (/\$\$[\s\S]+?\$\$/.test(prose)) risks.push("math")
  return risks
}
