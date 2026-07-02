import { useEffect, useState } from "react"

const DISMISS_MS = 6_000

/** Subscribe to `quincy:appError` events; returns the current message or null. */
export function useAppErrorBanner(): string | null {
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null
    function handler(e: Event) {
      setMessage((e as CustomEvent<string>).detail)
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => setMessage(null), DISMISS_MS)
    }
    window.addEventListener("quincy:appError", handler)
    return () => {
      if (timer) clearTimeout(timer)
      window.removeEventListener("quincy:appError", handler)
    }
  }, [])

  return message
}
