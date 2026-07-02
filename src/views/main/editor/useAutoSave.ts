import { useEffect, useRef, useState } from "react"
import { DocumentSaver } from "./documentSaver"

interface DocumentSaverCallbacks {
  write: (key: string, content: string) => Promise<void>
  onSaved: (key: string, content: string) => void
  onError: (key: string, error: unknown) => void
}

/** A stable DocumentSaver whose callbacks always see the latest render's values. */
export function useDocumentSaver(callbacks: DocumentSaverCallbacks): DocumentSaver {
  const callbacksRef = useRef(callbacks)
  callbacksRef.current = callbacks
  const [saver] = useState(
    () =>
      new DocumentSaver({
        write: (key, content) => callbacksRef.current.write(key, content),
        onSaved: (key, content) => callbacksRef.current.onSaved(key, content),
        onError: (key, error) => callbacksRef.current.onError(key, error),
      }),
  )
  return saver
}

/** Schedule a debounced save whenever dirty content changes for `key`. */
export function useAutoSaveSchedule(
  saver: DocumentSaver,
  key: string | null,
  content: string,
  enabled: boolean,
) {
  useEffect(() => {
    if (!enabled || !key) return
    saver.schedule(key, content)
  }, [saver, key, content, enabled])
}

/** Best-effort flush of pending saves when the window is going away. */
export function useFlushOnQuit(savers: DocumentSaver[]) {
  const saversRef = useRef(savers)
  saversRef.current = savers
  useEffect(() => {
    function handler() {
      for (const saver of saversRef.current) void saver.flush()
    }
    window.addEventListener("pagehide", handler)
    window.addEventListener("beforeunload", handler)
    return () => {
      window.removeEventListener("pagehide", handler)
      window.removeEventListener("beforeunload", handler)
    }
  }, [])
}
