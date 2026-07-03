import { QuickOpenModal } from "quincy"

const noop = () => {}

// `position: fixed` overlay — a `transform` wrapper becomes its containing block
// so it fills this box instead of collapsing against a 0-height mount.
const stage: React.CSSProperties = {
  position: "relative",
  width: "100%",
  height: 560,
  transform: "translateZ(0)",
  overflow: "hidden",
  background: "var(--color-surface-1)",
}

const results = [
  { kind: "file" as const, name: "README.md", path: "/Users/dev/quincy/README.md" },
  { kind: "file" as const, name: "DESIGN.md", path: "/Users/dev/quincy/DESIGN.md" },
  {
    kind: "content" as const,
    name: "tailwind.css",
    path: "/Users/dev/quincy/src/styles/tailwind.css",
    lineNumber: 42,
    snippet: "--color-accent: #7c6af7;",
  },
  {
    kind: "content" as const,
    name: "EditorContext.tsx",
    path: "/Users/dev/quincy/src/editor/EditorContext.tsx",
    lineNumber: 88,
    snippet: "Auto-save debounces 800ms on content change when isDirty",
  },
]

export const CommandPalette = () => (
  <div style={stage}>
    <QuickOpenModal
      query="acc"
      onQueryChange={noop}
      results={results}
      selectedIndex={0}
      onSelect={noop}
      onKeyDown={noop}
      onClose={noop}
    />
  </div>
)

export const Empty = () => (
  <div style={stage}>
    <QuickOpenModal
      query="zzznope"
      onQueryChange={noop}
      results={[]}
      selectedIndex={0}
      onSelect={noop}
      onKeyDown={noop}
      onClose={noop}
    />
  </div>
)
