import { TreeContextMenu } from "quincy"

const noop = () => {}

// Renders a full-screen `fixed` dismiss layer + a menu anchored at menu.x/menu.y.
// A `transform` wrapper becomes the containing block for the fixed layer so the
// card measures a real height; the menu anchors near the top-left of the box.
const stage: React.CSSProperties = {
  position: "relative",
  width: "100%",
  height: 260,
  transform: "translateZ(0)",
  overflow: "hidden",
  background: "var(--color-surface-1)",
}

export const FileMenu = () => (
  <div style={stage}>
    <TreeContextMenu
      menu={{ x: 24, y: 24, node: { name: "README.md", path: "/workspace/README.md", isFolder: false } }}
      onClose={noop}
      onNewFile={noop}
      onRename={noop}
      onDelete={noop}
    />
  </div>
)

export const FolderMenu = () => (
  <div style={stage}>
    <TreeContextMenu
      menu={{ x: 24, y: 24, node: { name: "src", path: "/workspace/src", isFolder: true } }}
      onClose={noop}
      onNewFile={noop}
      onRename={noop}
      onDelete={noop}
    />
  </div>
)
