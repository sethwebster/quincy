import { useEffect } from "react"

export function useHotkey(key: string, callback: () => void) {
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.metaKey && e.key === key) {
        e.preventDefault()
        callback()
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [key, callback])
}
