import { ModeToggle } from "quincy"

const stage: React.CSSProperties = { padding: 28, background: "var(--color-surface-0)" }
const noop = () => {}

export const RichSelected = () => (
  <div style={stage}>
    <ModeToggle mode="rich" onChange={noop} />
  </div>
)

export const SplitSelected = () => (
  <div style={stage}>
    <ModeToggle mode="split" onChange={noop} />
  </div>
)

export const SourceSelected = () => (
  <div style={stage}>
    <ModeToggle mode="source" onChange={noop} />
  </div>
)
