import { useState, useCallback, useEffect, useMemo, useRef } from "react"
import { rpc } from "../rpc/client"
import { reportAppError, reportAppMessage } from "../errors"
import { createMarkdownFileIn } from "../files"
import { useEditor } from "../editor/EditorContext"
import type { DirEntry, TreeNode } from "../../../shared/types"
import { normalizeWorkspaceFolders } from "../../../shared/workspaceFolders"

type ChildrenMap = Record<string, DirEntry[]>

function buildFlatTree(
  paths: string[],
  childrenMap: ChildrenMap,
  expanded: Record<string, boolean>,
  depth: number,
): TreeNode[] {
  const result: TreeNode[] = []
  for (const path of paths) {
    const name = path.split("/").pop() ?? path
    const isExpanded = expanded[path] ?? false
    result.push({ name, path, isFolder: true, depth, isExpanded })
    if (isExpanded && childrenMap[path]) {
      for (const entry of childrenMap[path]) {
        if (entry.isDirectory) {
          result.push(...buildFlatTree([entry.path], childrenMap, expanded, depth + 1))
        } else {
          result.push({
            name: entry.name,
            path: entry.path,
            isFolder: false,
            depth: depth + 1,
            isExpanded: false,
          })
        }
      }
    }
  }
  return result
}

function parentDir(path: string): string {
  return path.slice(0, path.lastIndexOf("/"))
}

/** Refresh a folder's cached children when a file is created inside it. */
function useRefreshOnFileCreated(refreshDir: (dir: string) => Promise<void>) {
  const ref = useRef(refreshDir)
  ref.current = refreshDir
  useEffect(() => {
    const listener = (e: Event) => void ref.current(parentDir((e as CustomEvent<string>).detail))
    window.addEventListener("quincy:fileCreated", listener)
    return () => window.removeEventListener("quincy:fileCreated", listener)
  }, [])
}

/** State + actions for the row context menu (new file / rename / trash). */
export interface TreeMenuState {
  x: number
  y: number
  node: TreeNode
}

export function useFileTree(folders: string[]) {
  const { openFile: editorOpenFile } = useEditor()
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [childrenMap, setChildrenMap] = useState<ChildrenMap>({})
  const [scopedFolder, setScopedFolder] = useState<string | null>(null)
  const [scopeDirection, setScopeDirection] = useState<"forward" | "back">("forward")
  const [menu, setMenu] = useState<TreeMenuState | null>(null)
  const [renamingPath, setRenamingPath] = useState<string | null>(null)
  const uniqueFolders = useMemo(() => normalizeWorkspaceFolders(folders), [folders])

  const refreshDir = useCallback(async (dir: string) => {
    try {
      const entries = await rpc.request.listDirectory({ path: dir })
      setChildrenMap((prev) => ({ ...prev, [dir]: entries }))
    } catch {
      // tree refresh is best-effort; the underlying operation already landed
    }
  }, [])

  useRefreshOnFileCreated(refreshDir)

  // When scoped, render only the focused folder's contents as the tree root
  // (drop the folder row itself and pull its children up to depth 0).
  const nodes = useMemo(() => {
    if (scopedFolder) {
      return buildFlatTree([scopedFolder], childrenMap, expanded, 0)
        .slice(1)
        .map((n) => ({ ...n, depth: n.depth - 1 }))
    }
    return buildFlatTree(uniqueFolders, childrenMap, expanded, 0)
  }, [scopedFolder, uniqueFolders, childrenMap, expanded])

  const ensureChildren = useCallback(
    async (path: string) => {
      if (!childrenMap[path]) {
        try {
          const entries = await rpc.request.listDirectory({ path })
          setChildrenMap((prev) => ({ ...prev, [path]: entries }))
        } catch (error) {
          reportAppError(`Couldn't read folder ${path.split("/").pop() ?? path}`, error)
        }
      }
    },
    [childrenMap],
  )

  const toggleExpand = useCallback(
    async (path: string) => {
      if (expanded[path]) {
        setExpanded((prev) => ({ ...prev, [path]: false }))
        return
      }
      await ensureChildren(path)
      setExpanded((prev) => ({ ...prev, [path]: true }))
    },
    [expanded, ensureChildren],
  )

  const scopeToFolder = useCallback(
    async (path: string) => {
      await ensureChildren(path)
      setExpanded((prev) => ({ ...prev, [path]: true }))
      setScopeDirection("forward")
      setScopedFolder(path)
    },
    [ensureChildren],
  )

  const clearScope = useCallback(() => {
    setScopeDirection("back")
    setScopedFolder(null)
  }, [])

  const openFile = useCallback(
    async (path: string) => {
      try {
        const file = await rpc.request.readFile({ path })
        editorOpenFile(path, file.content, file.mtimeMs)
      } catch (error) {
        reportAppError(`Couldn't open ${path.split("/").pop() ?? path}`, error)
      }
    },
    [editorOpenFile],
  )

  const scopedFolderName = scopedFolder ? scopedFolder.split("/").pop() ?? scopedFolder : null

  // ── Context-menu file operations ──────────────────────────────────────────

  const openMenu = useCallback((node: TreeNode, x: number, y: number) => {
    setMenu({ node, x, y })
  }, [])

  const closeMenu = useCallback(() => setMenu(null), [])

  const newFileIn = useCallback(
    async (dir: string) => {
      setMenu(null)
      try {
        const { path, mtimeMs } = await createMarkdownFileIn(dir)
        setExpanded((prev) => ({ ...prev, [dir]: true }))
        editorOpenFile(path, "", mtimeMs)
        setRenamingPath(path) // a fresh "Untitled.md" almost always wants a name
      } catch (error) {
        reportAppError("Couldn't create a new file", error)
      }
    },
    [editorOpenFile],
  )

  const startRename = useCallback((path: string) => {
    setMenu(null)
    setRenamingPath(path)
  }, [])

  const cancelRename = useCallback(() => setRenamingPath(null), [])

  const commitRename = useCallback(
    async (path: string, newName: string) => {
      setRenamingPath(null)
      try {
        const { newPath } = await rpc.request.renameFile({ path, newName })
        if (newPath !== path) {
          window.dispatchEvent(
            new CustomEvent("quincy:fileRenamed", { detail: { from: path, to: newPath } }),
          )
          await refreshDir(parentDir(path))
        }
      } catch (error) {
        reportAppError("Couldn't rename", error)
      }
    },
    [refreshDir],
  )

  const deleteFile = useCallback(
    async (path: string) => {
      setMenu(null)
      try {
        await rpc.request.deleteFile({ path })
        window.dispatchEvent(new CustomEvent("quincy:fileDeleted", { detail: path }))
        await refreshDir(parentDir(path))
        reportAppMessage(`Moved ${path.split("/").pop()} to Trash`)
      } catch (error) {
        reportAppError("Couldn't move to Trash", error)
      }
    },
    [refreshDir],
  )

  return {
    nodes,
    toggleExpand,
    openFile,
    scopedFolder,
    scopedFolderName,
    scopeDirection,
    scopeToFolder,
    clearScope,
    menu,
    openMenu,
    closeMenu,
    renamingPath,
    newFileIn,
    startRename,
    cancelRename,
    commitRename,
    deleteFile,
  }
}
