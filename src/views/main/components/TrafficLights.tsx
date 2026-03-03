import { useState } from "react"
import { rpc } from "../rpc/client"

function useTrafficLightHover() {
  const [hovered, setHovered] = useState(false)
  return { hovered, onMouseEnter: () => setHovered(true), onMouseLeave: () => setHovered(false) }
}

export function TrafficLights() {
  const { hovered, onMouseEnter, onMouseLeave } = useTrafficLightHover()

  return (
    <div
      className="flex items-center gap-2"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <button
        onClick={() => void rpc.request.windowClose({})}
        className="group flex h-3 w-3 items-center justify-center rounded-full"
        style={{ background: hovered ? "#ff5f57" : "rgba(255,255,255,0.2)" }}
        title="Close"
      >
        {hovered && (
          <svg width="6" height="6" viewBox="0 0 6 6">
            <path d="M0.5 0.5L5.5 5.5M5.5 0.5L0.5 5.5" stroke="rgba(0,0,0,0.6)" strokeWidth="1.2" />
          </svg>
        )}
      </button>
      <button
        onClick={() => void rpc.request.windowMinimize({})}
        className="group flex h-3 w-3 items-center justify-center rounded-full"
        style={{ background: hovered ? "#febc2e" : "rgba(255,255,255,0.2)" }}
        title="Minimize"
      >
        {hovered && (
          <svg width="6" height="2" viewBox="0 0 6 2">
            <path d="M0.5 1H5.5" stroke="rgba(0,0,0,0.6)" strokeWidth="1.2" />
          </svg>
        )}
      </button>
      <button
        onClick={() => void rpc.request.windowMaximize({})}
        className="group flex h-3 w-3 items-center justify-center rounded-full"
        style={{ background: hovered ? "#28c840" : "rgba(255,255,255,0.2)" }}
        title="Maximize"
      >
        {hovered && (
          <svg width="6" height="6" viewBox="0 0 6 6">
            <path d="M1 1L5 1L5 5L1 5Z" stroke="rgba(0,0,0,0.6)" strokeWidth="1.2" fill="none" />
          </svg>
        )}
      </button>
    </div>
  )
}
