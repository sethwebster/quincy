import { useEffect, useRef, useState } from "react"
import { ChevronRight, FolderOpen, Folder, FileText, FolderPlus } from "lucide-react"
import { useEditor } from "../editor/EditorContext"
import type { TreeNode } from "../../../shared/types"
import { Button } from "../components/Button"

interface FileTreeListProps {
  nodes: TreeNode[]
  scoped: boolean
  onToggle: (path: string) => void
  onOpenFile: (path: string) => void
  onScopeFolder: (path: string) => void
  onAddFolder: () => void
  onContextMenu?: (node: TreeNode, x: number, y: number) => void
  renamingPath?: string | null
  onRenameCommit?: (path: string, newName: string) => void
  onRenameCancel?: () => void
}

export function FileTreeList({
  nodes,
  scoped,
  onToggle,
  onOpenFile,
  onScopeFolder,
  onAddFolder,
  onContextMenu,
  renamingPath,
  onRenameCommit,
  onRenameCancel,
}: FileTreeListProps) {
  const { activeFilePath } = useEditor()

  if (nodes.length === 0) {
    return scoped ? (
      <p className="px-4 py-8 text-center text-xs" style={{ color: "var(--color-text-muted)" }}>
        This folder is empty
      </p>
    ) : (
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
          onScopeFolder={onScopeFolder}
          onContextMenu={onContextMenu}
          isRenaming={renamingPath === node.path}
          onRenameCommit={onRenameCommit}
          onRenameCancel={onRenameCancel}
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
  onScopeFolder: (path: string) => void
  onContextMenu?: (node: TreeNode, x: number, y: number) => void
  isRenaming?: boolean
  onRenameCommit?: (path: string, newName: string) => void
  onRenameCancel?: () => void
}

/** Inline rename field shown in place of the row label. */
function RenameInput({
  node,
  onCommit,
  onCancel,
}: {
  node: TreeNode
  onCommit?: (path: string, newName: string) => void
  onCancel?: () => void
}) {
  const [value, setValue] = useState(node.name.replace(/\.md$/i, ""))
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  return (
    <input
      ref={inputRef}
      value={value}
      spellCheck={false}
      autoCorrect="off"
      autoCapitalize="off"
      className="no-drag w-full rounded border bg-transparent px-1 py-0 text-xs font-medium outline-none"
      style={{ borderColor: "var(--color-accent)", color: "var(--color-text-primary)" }}
      onChange={(e) => setValue(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault()
          onCommit?.(node.path, value)
        } else if (e.key === "Escape") {
          e.preventDefault()
          onCancel?.()
        }
      }}
      onBlur={() => onCancel?.()}
    />
  )
}

function FileTreeRow({
  node,
  isActive,
  onToggle,
  onOpenFile,
  onScopeFolder,
  onContextMenu,
  isRenaming,
  onRenameCommit,
  onRenameCancel,
}: FileTreeRowProps) {
  const indent = node.depth * 12

  function handleClick() {
    if (isRenaming) return
    if (node.isFolder) {
      onToggle(node.path)
    } else {
      onOpenFile(node.path)
    }
  }

  function handleDoubleClick() {
    if (node.isFolder) onScopeFolder(node.path)
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
      onDoubleClick={handleDoubleClick}
      onContextMenu={(e) => {
        if (!onContextMenu) return
        e.preventDefault()
        onContextMenu(node, e.clientX, e.clientY)
      }}
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
      {isRenaming ? (
        <RenameInput node={node} onCommit={onRenameCommit} onCancel={onRenameCancel} />
      ) : (
        <span className="flex-1 truncate text-xs font-medium">{node.name}</span>
      )}
    </button>
  )
}
