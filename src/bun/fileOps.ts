import { existsSync, renameSync, mkdirSync } from "node:fs"
import { join, dirname, basename } from "node:path"
import { homedir } from "node:os"

/** Normalize a user-typed markdown file name: trims, rejects separators and
 *  hidden names, enforces the .md extension. Returns an error string or null. */
export function validateMarkdownFileName(name: string): string | null {
  const trimmed = name.trim()
  if (!trimmed) return "Name can't be empty"
  if (trimmed.includes("/") || trimmed.includes("\\")) return "Name can't contain slashes"
  if (trimmed.startsWith(".")) return "Name can't start with a dot"
  return null
}

export function normalizeMarkdownFileName(name: string): string {
  const trimmed = name.trim()
  return trimmed.toLowerCase().endsWith(".md") ? trimmed : `${trimmed}.md`
}

/** Pick a non-colliding name inside the Trash (or any set of taken names). */
export function uniqueName(name: string, taken: (candidate: string) => boolean): string {
  if (!taken(name)) return name
  const dot = name.lastIndexOf(".")
  const stem = dot > 0 ? name.slice(0, dot) : name
  const ext = dot > 0 ? name.slice(dot) : ""
  for (let i = 2; ; i += 1) {
    const candidate = `${stem} ${i}${ext}`
    if (!taken(candidate)) return candidate
  }
}

/** Move a file to the user's Trash (macOS). Rename-based, so recoverable.
 *  Files on other volumes can't be renamed into ~/.Trash (EXDEV) — those go
 *  through Finder, which uses the volume's own .Trashes. */
export function moveToTrash(path: string): void {
  const trashDir = join(homedir(), ".Trash")
  if (!existsSync(trashDir)) mkdirSync(trashDir, { recursive: true })
  const target = uniqueName(basename(path), (candidate) => existsSync(join(trashDir, candidate)))
  try {
    renameSync(path, join(trashDir, target))
  } catch {
    const result = Bun.spawnSync([
      "/usr/bin/osascript",
      "-e",
      `tell application "Finder" to delete POSIX file ${JSON.stringify(path)}`,
    ])
    if (result.exitCode !== 0) {
      throw new Error(`Couldn't move to Trash: ${result.stderr.toString().trim()}`)
    }
  }
}

/** Rename a file within its directory. Returns the new absolute path. */
export function renameMarkdownFile(path: string, newName: string): string {
  const error = validateMarkdownFileName(newName)
  if (error) throw new Error(error)
  const normalized = normalizeMarkdownFileName(newName)
  const newPath = join(dirname(path), normalized)
  if (newPath === path) return path
  // Case-only renames: on APFS's case-insensitive default, existsSync(newPath)
  // is true because it IS this file — that's a legal rename, not a collision.
  const caseOnly = newPath.toLowerCase() === path.toLowerCase()
  if (!caseOnly && existsSync(newPath)) throw new Error(`${normalized} already exists`)
  renameSync(path, newPath)
  return newPath
}
