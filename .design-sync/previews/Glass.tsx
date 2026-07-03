import { Glass } from "quincy"

// Glass is translucent with a blurred backdrop — it only reads over textured
// content, so each cell sits on a subtle accent-lit surface.
const stage: React.CSSProperties = {
  padding: 40,
  background:
    "radial-gradient(120% 120% at 20% 0%, rgba(124,106,247,0.28), transparent 55%), var(--color-surface-0)",
}

const title: React.CSSProperties = {
  color: "var(--color-text-primary)",
  fontWeight: 600,
  fontSize: 14,
}
const body: React.CSSProperties = {
  color: "var(--color-text-secondary)",
  fontSize: 13,
  marginTop: 6,
  lineHeight: 1.5,
}

export const Panel = () => (
  <div style={stage}>
    <Glass style={{ padding: 20, width: 300, borderRadius: 12 }}>
      <div style={title}>Frosted panel</div>
      <div style={body}>
        The translucent surface primitive — a blurred, saturated backdrop behind
        every panel, modal, and menu in Quincy.
      </div>
    </Glass>
  </div>
)

export const Elevated = () => (
  <div style={stage}>
    <Glass elevated style={{ padding: 20, width: 300, borderRadius: 12 }}>
      <div style={title}>Elevated panel</div>
      <div style={body}>
        Same glass, with a deep drop shadow — used for floating surfaces that lift
        above the document.
      </div>
    </Glass>
  </div>
)
