import { useAuthActions } from "@convex-dev/auth/react"
import { useConvexAuth } from "convex/react"
import { AnimatePresence, motion } from "framer-motion"
import { ChevronLeft, FolderPlus, LogIn, LogOut } from "lucide-react"
import { Button } from "../components/Button"
import { Glass } from "../components/Glass"
import { useEditor } from "../editor/EditorContext"
import { DocumentList } from "./DocumentList"
import { FileTreeList } from "./FileTreeList"
import { TreeContextMenu } from "./TreeContextMenu"
import { useWorkspace } from "./useWorkspace"
import { useFileTree } from "./useFileTree"

// Slide the tree like a nav stack: push enters from the right, back from the left.
const slideVariants = {
  enter: (dir: "forward" | "back") => ({ x: dir === "forward" ? "100%" : "-100%", opacity: 0 }),
  center: { x: "0%", opacity: 1 },
  exit: (dir: "forward" | "back") => ({ x: dir === "forward" ? "-100%" : "100%", opacity: 0 }),
}

export function Sidebar() {
  const { folders, addFolder } = useWorkspace()
  const {
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
  } = useFileTree(folders)
  const { signOut } = useAuthActions()
  const { isAuthenticated } = useConvexAuth()
  const { activeDocumentId, setActiveDocumentId, closeFile } = useEditor()

  function handleSignOut() {
    // A cloud doc can't stay open without an account — close it first so the
    // doc query doesn't fail unauthenticated.
    if (activeDocumentId) closeFile()
    void signOut()
  }

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
        {scopedFolder ? (
          <button
            type="button"
            onClick={clearScope}
            title="Back to all folders"
            className="no-drag flex min-w-0 items-center gap-1 text-xs font-semibold tracking-wide"
            style={{ color: "var(--color-text-secondary)" }}
          >
            <ChevronLeft size={13} style={{ flexShrink: 0 }} />
            <span className="truncate">{scopedFolderName}</span>
          </button>
        ) : (
          <span
            className="text-xs font-semibold tracking-wider"
            style={{ color: "var(--color-text-muted)" }}
          >
            FOLDER EXPLORER
          </span>
        )}
        <Button
          size="sm"
          variant="ghost"
          onClick={addFolder}
          aria-label="Add folder"
          title="Add folder"
          className="no-drag h-8 w-8 p-0"
          style={{
            background: "var(--color-accent-dim)",
            border: "1px solid var(--color-glass-border)",
            boxShadow: "0 0 0 1px var(--color-accent-glow)",
            color: "var(--color-accent)",
          }}
        >
          <FolderPlus size={16} aria-hidden="true" />
        </Button>
      </div>

      {/* File tree — slides like a nav stack when scoping in/out of a folder */}
      <div className="relative flex-1 overflow-hidden">
        <AnimatePresence custom={scopeDirection} initial={false}>
          <motion.div
            key={scopedFolder ?? "__root__"}
            custom={scopeDirection}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: "spring", stiffness: 460, damping: 42 }}
            className="absolute inset-0 overflow-y-auto"
          >
            <FileTreeList
              nodes={nodes}
              scoped={scopedFolder !== null}
              onToggle={toggleExpand}
              onOpenFile={openFile}
              onScopeFolder={scopeToFolder}
              onAddFolder={addFolder}
              onContextMenu={openMenu}
              renamingPath={renamingPath}
              onRenameCommit={(path, newName) => void commitRename(path, newName)}
              onRenameCancel={cancelRename}
            />
          </motion.div>
        </AnimatePresence>
      </div>

      {menu && (
        <TreeContextMenu
          menu={menu}
          onClose={closeMenu}
          onNewFile={(dir) => void newFileIn(dir)}
          onRename={startRename}
          onDelete={(path) => void deleteFile(path)}
        />
      )}

      {/* Cloud documents — only when signed in */}
      {isAuthenticated && (
        <div className="border-t" style={{ borderColor: "var(--color-glass-border)" }}>
          <div className="px-4 pb-1 pt-3">
            <span
              className="text-xs font-semibold tracking-wider"
              style={{ color: "var(--color-text-muted)" }}
            >
              CLOUD DOCUMENTS
            </span>
          </div>
          <div className="max-h-48 overflow-y-auto">
            <DocumentList
              activeId={activeDocumentId}
              onSelect={(id) => setActiveDocumentId(id || null)}
            />
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="border-t px-3 py-2" style={{ borderColor: "var(--color-glass-border)" }}>
        {isAuthenticated ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={handleSignOut}
            className="w-full justify-start gap-2"
          >
            <LogOut size={13} />
            Sign out
          </Button>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => window.dispatchEvent(new CustomEvent("quincy:showSignIn"))}
            className="w-full justify-start gap-2"
            title="Sign in to sync documents and assistant threads"
          >
            <LogIn size={13} />
            Sign in to sync
          </Button>
        )}
      </div>
    </Glass>
  )
}
