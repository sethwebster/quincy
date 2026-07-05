import { useCallback, useEffect, useRef, useState } from "react"
import type { DirEntry } from "../../../shared/types"
import { reportAppError } from "../errors"
import { rpc } from "../rpc/client"

function folderSignature(folders: readonly string[]): string {
  return folders.join("\u0000")
}

export function useActionPanelFileIndex(isOpen: boolean, folders: readonly string[]) {
  const [files, setFiles] = useState<DirEntry[]>([])
  const loadedFoldersRef = useRef<string | null>(null)
  const requestRef = useRef(0)

  const reset = useCallback(() => {
    setFiles([])
    loadedFoldersRef.current = null
    requestRef.current += 1
  }, [])

  const invalidate = useCallback(() => {
    loadedFoldersRef.current = null
    requestRef.current += 1
  }, [])

  useEffect(() => {
    const signature = folderSignature(folders)
    if (!isOpen || folders.length === 0 || loadedFoldersRef.current === signature) return
    loadedFoldersRef.current = signature
    const request = requestRef.current + 1
    requestRef.current = request
    rpc.request
      .searchFiles({ roots: [...folders] })
      .then((found) => {
        if (requestRef.current === request) setFiles(found)
      })
      .catch((error) => {
        if (requestRef.current === request) reportAppError("Couldn't index workspace files", error)
      })
  }, [isOpen, folders])

  return { files, invalidate, reset }
}
