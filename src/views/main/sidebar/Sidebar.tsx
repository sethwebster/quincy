import { useAuthActions } from "@convex-dev/auth/react"
import { FolderPlus, LogOut } from "lucide-react"
import { Button } from "../components/Button"
import { Glass } from "../components/Glass"
import { FileTreeList } from "./FileTreeList"
import { useWorkspace } from "./useWorkspace"
import { useFileTree } from "./useFileTree"

export function Sidebar() {
  const { folders, addFolder } = useWorkspace()
  const { nodes, toggleExpand, openFile } = useFileTree(folders)
  const { signOut } = useAuthActions()

  return (
    <Glass
      className="flex h-full flex-col"
      style={{
        borderRight: "1px solid var(--color-glass-border)",
        borderRadius: 0,
        borderTop: 0,
        borderBottom: 0,
        borderLeft: 0,
      }}
    >
      {/* Title bar space + header */}
      <div className="flex items-center justify-between px-4 pb-2 pt-3">
        <span
          className="text-xs font-semibold tracking-wider"
          style={{ color: "var(--color-text-muted)" }}
        >
          FILES
        </span>
        <Button
          size="sm"
          variant="ghost"
          onClick={addFolder}
          title="Add folder"
          className="no-drag h-6 w-6 p-0"
        >
          <FolderPlus size={13} />
        </Button>
      </div>

      {/* File tree */}
      <div className="flex-1 overflow-y-auto">
        <FileTreeList
          nodes={nodes}
          onToggle={toggleExpand}
          onOpenFile={openFile}
          onAddFolder={addFolder}
        />
      </div>

      {/* Footer */}
      <div className="border-t px-3 py-2" style={{ borderColor: "var(--color-glass-border)" }}>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => void signOut()}
          className="w-full justify-start gap-2"
        >
          <LogOut size={13} />
          Sign out
        </Button>
      </div>
    </Glass>
  )
}
