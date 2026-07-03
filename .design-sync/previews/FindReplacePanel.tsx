import { FindReplacePanel } from "quincy"

// The panel floats absolute at the top-right of the editor canvas — the stage
// gives it a relative editor-surface to sit over.
export const Panel = () => (
  <div
    style={{
      position: "relative",
      height: 140,
      background: "var(--color-surface-1)",
      borderRadius: 10,
      margin: 16,
      border: "1px solid var(--color-glass-border)",
    }}
  >
    <FindReplacePanel
      query="quincy"
      replacement="Quincy"
      currentIndex={2}
      matchCount={7}
      onQueryChange={() => {}}
      onReplacementChange={() => {}}
      onNext={() => {}}
      onPrevious={() => {}}
      onReplace={() => {}}
      onReplaceAll={() => {}}
      onClose={() => {}}
    />
  </div>
)
