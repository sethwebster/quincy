function trimTrailingSeparators(path: string): string {
  const trimmed = path.trim()
  if (/^[/\\]+$/.test(trimmed)) return trimmed[0] ?? trimmed
  if (/^[A-Za-z]:[\\/]?$/.test(trimmed)) return trimmed
  return trimmed.replace(/[\\/]+$/, "")
}

export function normalizeWorkspaceFolder(path: string): string | null {
  const normalized = trimTrailingSeparators(path)
  return normalized.length > 0 ? normalized : null
}

export function normalizeWorkspaceFolders(folders: readonly string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []

  for (const folder of folders) {
    const normalized = normalizeWorkspaceFolder(folder)
    if (!normalized || seen.has(normalized)) continue
    seen.add(normalized)
    result.push(normalized)
  }

  return result
}

export function appendWorkspaceFolder(folders: readonly string[], folder: string): string[] {
  return normalizeWorkspaceFolders([...folders, folder])
}
