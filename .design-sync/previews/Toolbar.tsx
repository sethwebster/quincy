import { Toolbar } from "quincy"

// Toolbar only renders items in "rich" mode (source/split write syntax directly).
export const Formatting = () => (
  <div
    style={{
      background: "var(--color-surface-1)",
      borderRadius: 10,
      overflow: "hidden",
      width: 380,
      margin: 24,
      border: "1px solid var(--color-glass-border)",
    }}
  >
    <Toolbar mode="rich" onAction={() => {}} />
  </div>
)
