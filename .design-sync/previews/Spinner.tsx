import { Spinner } from "quincy"

const cell: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 10,
}
const cap: React.CSSProperties = { color: "var(--color-text-muted)", fontSize: 11 }

export const Sizes = () => (
  <div style={{ display: "flex", gap: 40, alignItems: "center", padding: 40, background: "var(--color-surface-0)" }}>
    <div style={cell}>
      <Spinner size={16} />
      <span style={cap}>16px</span>
    </div>
    <div style={cell}>
      <Spinner size={24} />
      <span style={cap}>24px</span>
    </div>
    <div style={cell}>
      <Spinner size={40} />
      <span style={cap}>40px</span>
    </div>
  </div>
)
