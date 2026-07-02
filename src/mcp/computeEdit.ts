/** Pure edit computation for the quincy MCP `edit_document` tool. */

export type EditRequest = {
  content?: string
  find?: string
  replace?: string
}

export type EditResult =
  | { ok: true; next: string; summary: string }
  | { ok: false; error: string }

export function computeEdit(docContent: string, request: EditRequest): EditResult {
  if (request.content !== undefined) {
    return { ok: true, next: request.content, summary: "Document updated." }
  }
  if (request.find === undefined || request.replace === undefined) {
    return { ok: false, error: "Provide either `content`, or both `find` and `replace`." }
  }
  const occurrences = request.find === "" ? 0 : docContent.split(request.find).length - 1
  if (occurrences === 0) {
    return { ok: false, error: "`find` text not found in the document." }
  }
  const next = docContent.replaceAll(request.find, request.replace)
  return {
    ok: true,
    next,
    summary: `Document updated (${occurrences} occurrence${occurrences === 1 ? "" : "s"} replaced).`,
  }
}
