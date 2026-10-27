import { useState, useEffect } from "react"
import { normalizeWorkspaceFolders } from "../../../shared/workspaceFolders"
import { rpc } from "../rpc/client"
import { reportAppError } from "../errors"

export function useWorkspace() {
  const [folders, setFolders] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  // Load persisted folders on mount
  useEffect(() => {
    rpc.request
      .getPreferences({})
      .then((prefs) => setFolders(normalizeWorkspaceFolders(prefs.workspaceFolders ?? [])))
      .catch((error) => reportAppError("Couldn't load workspace folders", error))
      .finally(() => setLoading(false))
  }, [])

  // Sync when bun adds a folder (menu or sidebar both go through bun's dialog)
  useEffect(() => {
    function handler(e: Event) {
      setFolders(normalizeWorkspaceFolders((e as CustomEvent<string[]>).detail))
    }
    window.addEventListener("quincy:workspaceFoldersChanged", handler)
    return () => window.removeEventListener("quincy:workspaceFoldersChanged", handler)
  }, [])

  // Fire-and-forget: bun shows the modal dialog, persists the folder, and
  // pushes workspaceFoldersChanged back, so slow browsing can't time out.
  const addFolder = () => rpc.send.addFolderDialog({})

  return { folders, loading, addFolder }
}
