import type { ActionPanelItem, CreateFileItemsOptions } from "./actionPanelTypes"

type FileActionPanelItem = ActionPanelItem & { kind: "file"; source: { path: string } }
type ContentActionPanelItem = ActionPanelItem & { kind: "content"; source: { path: string; lineNumber: number } }

export function createFileItems({ files, contentMatches, openFile }: CreateFileItemsOptions): ActionPanelItem[] {
  const fileItems: FileActionPanelItem[] = files.map((file) => {
    const item: FileActionPanelItem = {
      id: `file:${file.path}`,
      mode: "files",
      kind: "file",
      title: file.name,
      description: file.path,
      keywords: [file.name, file.path],
      icon: "file",
      meta: "File",
      source: { path: file.path },
      perform: () => openFile(item),
    }
    return item
  })

  const contentItems: ContentActionPanelItem[] = contentMatches.map((match) => {
    const item: ContentActionPanelItem = {
      id: `content:${match.path}:${match.lineNumber}`,
      mode: "files",
      kind: "content",
      title: `${match.name}:${match.lineNumber}`,
      description: match.snippet,
      keywords: [match.name, match.path, match.snippet, String(match.lineNumber)],
      icon: "content",
      meta: "Content",
      source: { path: match.path, lineNumber: match.lineNumber },
      perform: () => openFile(item),
    }
    return item
  })

  return [...fileItems, ...contentItems]
}
