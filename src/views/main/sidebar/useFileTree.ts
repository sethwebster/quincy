import { useState, useCallback, useMemo } from "react"
import { rpc } from "../rpc/client"
import { useEditor } from "../editor/EditorContext"
import type { DirEntry, TreeNode } from "../../../shared/types"

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

export function useFileTree(folders: string[]) {
  const { openFile: editorOpenFile } = useEditor()
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [childrenMap, setChildrenMap] = useState<ChildrenMap>({})

  const nodes = useMemo(
    () => buildFlatTree(folders, childrenMap, expanded, 0),
    [folders, childrenMap, expanded],
  )

  const toggleExpand = useCallback(
    async (path: string) => {
      if (expanded[path]) {
        setExpanded((prev) => ({ ...prev, [path]: false }))
        return
      }
      if (!childrenMap[path]) {
        const entries = await rpc.request.listDirectory({ path })
        setChildrenMap((prev) => ({ ...prev, [path]: entries }))
      }
      setExpanded((prev) => ({ ...prev, [path]: true }))
    },
    [expanded, childrenMap],
  )

  const openFile = useCallback(
    async (path: string) => {
      const content = await rpc.request.readFile({ path })
      editorOpenFile(path, content)
    },
    [editorOpenFile],
  )

  return { nodes, toggleExpand, openFile }
}
