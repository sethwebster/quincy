import { useState, useEffect, useCallback } from "react"
import { appendWorkspaceFolder, normalizeWorkspaceFolders } from "../../../shared/workspaceFolders"
import { rpc } from "../rpc/client"

export function useWorkspace() {
  const [folders, setFolders] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  // Load persisted folders on mount
  useEffect(() => {
    void rpc.request.getPreferences({}).then((prefs) => {
      setFolders(normalizeWorkspaceFolders(prefs.workspaceFolders ?? []))
      setLoading(false)
    })
  }, [])

  // Sync when bun updates folders via the app menu
  useEffect(() => {
    function handler(e: Event) {
      setFolders(normalizeWorkspaceFolders((e as CustomEvent<string[]>).detail))
    }
    window.addEventListener("quincy:workspaceFoldersChanged", handler)
    return () => window.removeEventListener("quincy:workspaceFoldersChanged", handler)
  }, [])

  const addFolder = useCallback(async () => {
    const path = await rpc.request.showOpenFolderDialog({})
    if (!path) return
    const next = appendWorkspaceFolder(folders, path)
    setFolders(next)
    await rpc.request.setPreferences({ workspaceFolders: next })
  }, [folders])

  return { folders, loading, addFolder }
}
