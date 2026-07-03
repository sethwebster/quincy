import { Button } from "quincy"

const row: React.CSSProperties = {
  display: "flex",
  gap: 12,
  alignItems: "center",
  padding: 28,
  flexWrap: "wrap",
  background: "var(--color-surface-0)",
}

export const Variants = () => (
  <div style={row}>
    <Button variant="primary">Save changes</Button>
    <Button variant="ghost">Cancel</Button>
    <Button variant="danger">Delete file</Button>
  </div>
)

export const Sizes = () => (
  <div style={row}>
    <Button variant="primary" size="sm">Small</Button>
    <Button variant="primary" size="md">Medium</Button>
    <Button variant="ghost" size="sm">Ghost sm</Button>
    <Button variant="ghost" size="md">Ghost md</Button>
  </div>
)

export const States = () => (
  <div style={row}>
    <Button variant="primary" loading>Saving…</Button>
    <Button variant="ghost" disabled>Disabled</Button>
    <Button variant="primary">Export as HTML</Button>
  </div>
)
