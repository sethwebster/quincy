import { createRoot } from "react-dom/client"
import { ConvexAuthProvider } from "@convex-dev/auth/react"
import { convex } from "./convex/client"
import { App } from "./App"

// ── RPC setup — must happen before React mounts ────────────────────────────
// electro is initialized in rpc/client.ts; import it here so the socket
// connects and message handlers register before the React tree mounts.
import "./rpc/client"

// ── Auth storage bridge ────────────────────────────────────────────────────
// Desktop WebViews can have inconsistent localStorage persistence.
// We write through to localStorage and fall back gracefully.

const authStorage = {
  getItem: (key: string) => localStorage.getItem(key),
  setItem: (key: string, value: string) => localStorage.setItem(key, value),
  removeItem: (key: string) => localStorage.removeItem(key),
}

// ── Mount ──────────────────────────────────────────────────────────────────

const root = document.getElementById("root")!

if (!convex) {
  createRoot(root).render(
    <div style={{ display: "flex", height: "100vh", alignItems: "center", justifyContent: "center", fontFamily: "system-ui", color: "#888" }}>
      <div style={{ textAlign: "center" }}>
        <p style={{ fontSize: 14 }}>CONVEX_URL is not set.</p>
        <p style={{ fontSize: 12, marginTop: 4 }}>Add it to .env.local and rebuild.</p>
      </div>
    </div>
  )
} else {
  createRoot(root).render(
    <ConvexAuthProvider client={convex} storage={authStorage}>
      <App />
    </ConvexAuthProvider>,
  )
}
