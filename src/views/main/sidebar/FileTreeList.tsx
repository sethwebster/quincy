import { ChevronRight, FolderOpen, Folder, FileText, FolderPlus } from "lucide-react"
import { useEditor } from "../editor/EditorContext"
import type { TreeNode } from "../../../shared/types"
import { Button } from "../components/Button"

interface FileTreeListProps {
  nodes: TreeNode[]
  onToggle: (path: string) => void
  onOpenFile: (path: string) => void
  onAddFolder: () => void
}

export function FileTreeList({ nodes, onToggle, onOpenFile, onAddFolder }: FileTreeListProps) {
  const { activeFilePath } = useEditor()

  if (nodes.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 px-4 py-8">
        <p className="text-center text-xs" style={{ color: "var(--color-text-muted)" }}>
          No folders yet
        </p>
        <Button size="sm" variant="ghost" onClick={onAddFolder} className="gap-1.5">
          <FolderPlus size={13} />
          Add Folder
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-0 py-1">
      {nodes.map((node) => (
        <FileTreeRow
          key={node.path}
          node={node}
          isActive={activeFilePath === node.path}
          onToggle={onToggle}
          onOpenFile={onOpenFile}
        />
      ))}
    </div>
  )
}

interface FileTreeRowProps {
  node: TreeNode
  isActive: boolean
  onToggle: (path: string) => void
  onOpenFile: (path: string) => void
}

function FileTreeRow({ node, isActive, onToggle, onOpenFile }: FileTreeRowProps) {
  const indent = node.depth * 12

  function handleClick() {
    if (node.isFolder) {
      onToggle(node.path)
    } else {
      onOpenFile(node.path)
    }
  }

  return (
    <button
      className="no-drag flex w-full items-center gap-1.5 rounded px-2 py-[3px] text-left transition-colors duration-75"
      style={{
        paddingLeft: `${8 + indent}px`,
        background: isActive ? "var(--color-accent-dim)" : "transparent",
        color: isActive ? "var(--color-text-primary)" : "var(--color-text-secondary)",
      }}
      onClick={handleClick}
      onMouseOver={(e) => {
        if (!isActive)
          (e.currentTarget as HTMLButtonElement).style.background = "var(--color-glass-hover)"
      }}
      onMouseOut={(e) => {
        if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = "transparent"
      }}
    >
      {node.isFolder ? (
        <>
          <ChevronRight
            size={12}
            style={{
              flexShrink: 0,
              color: "var(--color-text-muted)",
              transform: node.isExpanded ? "rotate(90deg)" : "rotate(0deg)",
              transition: "transform 0.15s ease",
            }}
          />
          {node.isExpanded ? (
            <FolderOpen size={13} style={{ flexShrink: 0, color: "var(--color-accent)" }} />
          ) : (
            <Folder size={13} style={{ flexShrink: 0, color: "var(--color-text-muted)" }} />
          )}
        </>
      ) : (
        <>
          <span style={{ width: 12, flexShrink: 0 }} />
          <FileText
            size={13}
            style={{
              flexShrink: 0,
              color: isActive ? "var(--color-accent)" : "var(--color-text-muted)",
            }}
          />
        </>
      )}
      <span className="flex-1 truncate text-xs font-medium">{node.name}</span>
    </button>
  )
}
