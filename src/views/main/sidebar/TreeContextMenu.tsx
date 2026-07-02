import { FilePlus, Pencil, Trash2 } from "lucide-react"
import { Glass } from "../components/Glass"
import type { TreeMenuState } from "./useFileTree"

interface TreeContextMenuProps {
  menu: TreeMenuState
  onClose: () => void
  onNewFile: (dir: string) => void
  onRename: (path: string) => void
  onDelete: (path: string) => void
}

interface MenuItemProps {
  icon: React.ReactNode
  label: string
  danger?: boolean
  onClick: () => void
}

function MenuItem({ icon, label, danger, onClick }: MenuItemProps) {
  return (
    <button
      className="no-drag flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs transition-colors"
      style={{ color: danger ? "var(--color-danger)" : "var(--color-text-primary)" }}
      onClick={onClick}
      onMouseOver={(e) => {
        ;(e.currentTarget as HTMLButtonElement).style.background = "var(--color-glass-hover)"
      }}
      onMouseOut={(e) => {
        ;(e.currentTarget as HTMLButtonElement).style.background = "transparent"
      }}
    >
      {icon}
      {label}
    </button>
  )
}

export function TreeContextMenu({ menu, onClose, onNewFile, onRename, onDelete }: TreeContextMenuProps) {
  const { node, x, y } = menu
  return (
    <div
      className="fixed inset-0 z-50"
      onClick={onClose}
      // A right-click outside must also dismiss — a stale menu acting on a
      // different row than the user last clicked is how files get mis-trashed.
      onContextMenu={(e) => {
        e.preventDefault()
        onClose()
      }}
    >
      <Glass
        elevated
        className="absolute flex w-44 flex-col gap-0.5 rounded-lg p-1"
        style={{
          left: Math.min(x, window.innerWidth - 190),
          top: Math.min(y, window.innerHeight - 120),
          background: "var(--color-surface-2)",
        }}
      >
        <div
          className="truncate px-2.5 pb-1 pt-1.5 text-[10px] font-semibold tracking-wide"
          style={{ color: "var(--color-text-muted)" }}
        >
          {node.name}
        </div>
        {node.isFolder ? (
          <MenuItem
            icon={<FilePlus size={13} />}
            label="New File Here"
            onClick={() => onNewFile(node.path)}
          />
        ) : (
          <>
            <MenuItem icon={<Pencil size={13} />} label="Rename" onClick={() => onRename(node.path)} />
            <MenuItem
              icon={<Trash2 size={13} />}
              label="Move to Trash"
              danger
              onClick={() => onDelete(node.path)}
            />
          </>
        )}
      </Glass>
    </div>
  )
}
