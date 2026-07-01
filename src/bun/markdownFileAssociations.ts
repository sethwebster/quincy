import { existsSync } from "node:fs"
import { spawnSync } from "node:child_process"
import { basename, dirname, extname } from "node:path"
import { fileURLToPath } from "node:url"

const MARKDOWN_EXTENSIONS = new Set([".md", ".markdown"])
const LSREGISTER_PATH = "/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister"

export function normalizeMarkdownFilePath(path: string): string | null {
  const trimmed = path.trim()
  if (!trimmed) return null
  return MARKDOWN_EXTENSIONS.has(extname(trimmed).toLowerCase()) ? trimmed : null
}

export function markdownPathFromFileUrl(url: string): string | null {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch (_error) {
    return null
  }

  if (parsed.protocol !== "file:") return null
  return normalizeMarkdownFilePath(fileURLToPath(parsed))
}

export function findAppBundlePath(executablePath: string): string | null {
  let current = dirname(executablePath)

  while (current !== dirname(current)) {
    if (basename(current).endsWith(".app")) return current
    current = dirname(current)
  }

  return null
}

export function registerMarkdownFileAssociation(): void {
  if (process.platform !== "darwin") return

  const appBundlePath = findAppBundlePath(process.execPath)
  if (!appBundlePath) return
  if (!existsSync(LSREGISTER_PATH)) throw new Error(`lsregister not found: ${LSREGISTER_PATH}`)

  const result = spawnSync(LSREGISTER_PATH, ["-f", appBundlePath], { stdio: "inherit" })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`lsregister failed with exit code ${result.status}`)
}
