import { resolve, sep } from "node:path"

/**
 * Trust boundary for renderer-initiated file access.
 *
 * The bun process has the user's full filesystem privileges; the renderer is a
 * webview and must not be able to read or write arbitrary paths through RPC.
 * Access is limited to:
 *  - workspace folders from validated preferences,
 *  - folders the user approved through a native dialog this session,
 *  - individual files the user opened via dialog, file association, or a
 *    restored session (registered bun-side with `allowFile`).
 */
export class FileAccessPolicy {
  private roots = new Set<string>()
  private approvedFolders = new Set<string>()
  private files = new Set<string>()

  setWorkspaceFolders(folders: string[]): void {
    this.roots = new Set(folders.map((f) => resolve(f)))
  }

  /** Record a folder the user just picked in a native dialog. */
  approveFolder(path: string): void {
    this.approvedFolders.add(resolve(path))
  }

  /** A folder may enter preferences only if it's already a root or the user
   *  approved it via dialog this session — the renderer can't invent one. */
  isFolderPermitted(path: string): boolean {
    const full = resolve(path)
    return this.roots.has(full) || this.approvedFolders.has(full)
  }

  /** Record a single file the user opened through a bun-side flow. */
  allowFile(path: string): void {
    this.files.add(resolve(path))
  }

  isAllowed(path: string): boolean {
    const full = resolve(path)
    if (this.files.has(full)) return true
    for (const root of [...this.roots, ...this.approvedFolders]) {
      if (full === root || full.startsWith(root + sep)) return true
    }
    return false
  }

  assertAllowed(path: string): void {
    if (!this.isAllowed(path)) {
      throw new Error(`Access denied: ${path} is outside the workspace`)
    }
  }

  /** Writes additionally permit derived artifacts (exported .html) beside an
   *  allowed markdown file — files opened via dialog or OS association live
   *  outside workspace roots but must still be exportable. */
  isWritable(path: string): boolean {
    if (this.isAllowed(path)) return true
    if (/\.html?$/i.test(path)) {
      return this.isAllowed(path.replace(/\.html?$/i, ".md"))
    }
    return false
  }

  assertWritable(path: string): void {
    if (!this.isWritable(path)) {
      throw new Error(`Access denied: ${path} is outside the workspace`)
    }
  }
}
